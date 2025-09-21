import {
  HttpBody,
  HttpClient,
  HttpClientOptions,
  HttpError,
  HttpResponse,
  RequestOptions,
} from '@subsquid/http-client'
import { addErrorContext, wait, withErrorContext } from '@subsquid/util-internal'
import { Readable } from 'stream'
import { ForkException } from './fork-exception'
import { LineSplitStream } from './line-split-stream'
import { PortalStreamBuffer } from './portal-stream-buffer'
import {
  BlockData as EvmBlockData,
  FinalizedQuery as EvmFinalizedQuery,
} from './types/evm/portal-query'
import {
  BlockData as SvmBlockData,
  FinalizedQuery as SvmFinalizedQuery,
} from './types/svm/portal-query'

const VERSION = 'alpha' // Placeholder for the actual version

const USER_AGENT = `@sqd-pipes/${VERSION} (https://sqd.ai)`

export interface PortalClientSettings {
  /**
   * Minimum number of bytes to return.
   * @default 10_485_760 (10MB)
   */
  minBytes?: number

  /**
   * Maximum number of bytes to return.
   * @default minBytes
   */
  maxBytes?: number

  /**
   * Maximum time between stream data in milliseconds for return.
   * @default 300
   */
  maxIdleTime?: number

  /**
   * Maximum wait time in milliseconds for return.
   * @default 5_000
   */
  maxWaitTime?: number

  /**
   * Interval for polling the head in milliseconds.
   * @default 0
   */
  headPollInterval?: number
}

type HeadersInit = Headers | string[][] | Record<string, string>

export interface PortalClientOptions {
  /**
   * The URL of the portal dataset.
   */
  url: string

  /**
   * Optional custom HTTP client to use.
   */
  http?: HttpClient | HttpClientOptions

  settings?: PortalClientSettings
}

export interface PortalRequestOptions {
  headers?: HeadersInit
  retryAttempts?: number
  retrySchedule?: number[]
  httpTimeout?: number
  bodyTimeout?: number
  abort?: AbortSignal
}

export interface PortalStreamOptions extends PortalClientSettings {
  request?: Omit<PortalRequestOptions, 'abort'>
  stopOnHead?: boolean
}

export type PortalStreamData<B> = {
  blocks: B[]
  finalizedHead?: BlockRef
}

export interface PortalStream<B> extends ReadableStream<PortalStreamData<B>> {}

export type PortalQuery = SvmFinalizedQuery | EvmFinalizedQuery

export type BlockRef = {
  hash: string
  number: number
}

export type PortalResponse<Q extends PortalQuery> = Q['type'] extends 'solana'
  ? SvmBlockData<Q['fields']>
  : EvmBlockData<Q['fields']>

export type PortalStats = {
  bytesReceived: number
}

export class PortalClient {
  private client: HttpClient
  private readonly url: URL
  private readonly settings: Required<PortalClientSettings>

  private bytesReceived = 0

  constructor(options: PortalClientOptions) {
    this.url = new URL(options.url)
    this.client = options.http instanceof HttpClient ? options.http : new HttpClient(options.http)
    this.settings = {
      headPollInterval: 0,
      minBytes: 10 * 1024 * 1024,
      maxBytes: 10 * 1024 * 1024,
      maxIdleTime: 300,
      maxWaitTime: 5_000,
      ...options.settings,
    }
  }

  private getDatasetUrl(path: string): string {
    const u = new URL(this.url)
    if (this.url.pathname.endsWith('/')) {
      u.pathname += path
    } else {
      u.pathname += '/' + path
    }
    return u.toString()
  }

  // TODO why undefined?
  async getHead(options?: PortalRequestOptions): Promise<BlockRef | undefined> {
    const res = await this.request('GET', this.getDatasetUrl('head'), options)
    return res.body ?? undefined
  }

  async getFinalizedHead(options?: PortalRequestOptions): Promise<BlockRef | undefined> {
    const res = await this.request('GET', this.getDatasetUrl('finalized-head'), options)
    return res.body ?? undefined
  }

  getFinalizedQuery<
    Q extends PortalQuery = PortalQuery,
    R extends PortalResponse<Q> = PortalResponse<Q>,
  >(query: Q, options?: PortalRequestOptions): Promise<R[]> {
    // FIXME: is it needed or it is better to always use stream?
    return this.request<Buffer>('POST', this.getDatasetUrl(`finalized-stream`), {
      ...options,
      json: query,
    })
      .catch(withErrorContext({ archiveQuery: query }))
      .then((res) => {
        return res.body
          .toString('utf8')
          .trimEnd()
          .split('\n')
          .map((line) => JSON.parse(line))
      })
  }

  getQuery<Q extends PortalQuery = PortalQuery, R extends PortalResponse<Q> = PortalResponse<Q>>(
    query: Q,
    options?: PortalRequestOptions,
  ): Promise<R[]> {
    // FIXME: is it needed or it is better to always use stream?
    return this.request<Buffer>('POST', this.getDatasetUrl(`stream`), {
      ...options,
      json: query,
    })
      .catch(withErrorContext({ archiveQuery: query }))
      .then((res) => {
        return res.body
          .toString('utf8')
          .trimEnd()
          .split('\n')
          .map((line) => JSON.parse(line))
      })
  }

  getFinalizedStream<
    Q extends PortalQuery = PortalQuery,
    R extends PortalResponse<Q> = PortalResponse<Q>,
  >(query: Q, options?: PortalStreamOptions): PortalStream<R> {
    return this.createReadablePortalStream('finalized-stream', query, options)
  }

  getStream<Q extends PortalQuery = PortalQuery, R extends PortalResponse<Q> = PortalResponse<Q>>(
    query: Q,
    options?: PortalStreamOptions,
  ): PortalStream<R> {
    return this.createReadablePortalStream('stream', query, options)
  }

  createReadablePortalStream<
    Q extends PortalQuery = PortalQuery,
    R extends PortalResponse<Q> = PortalResponse<Q>,
  >(url: string, query: Q, options?: PortalStreamOptions): PortalStream<R> {
    const {
      headPollInterval,
      stopOnHead,
      request,
      ...bufferOptions
    }: Required<PortalStreamOptions> = {
      request: {},
      stopOnHead: false,
      ...this.settings,
      ...options,
    }

    const abortStream = new AbortController()

    const buffer = new PortalStreamBuffer<R>(bufferOptions)
    let finalizedHead: BlockRef | undefined

    this.bytesReceived = 0

    const ingest = async () => {
      const abortSignal = abortStream.signal
      let { fromBlock = 0, toBlock = Infinity, parentBlockHash } = query

      while (true) {
        let reader: ReadableStreamDefaultReader<string[]> | undefined
        try {
          if (abortSignal.aborted) break
          if (fromBlock > toBlock) break

          const res = await this.getStreamRequest(
            url,
            {
              ...query,
              fromBlock,
              parentBlockHash,
            },
            {
              ...request,
              abort: abortSignal,
            },
          )

          if (res == null) {
            if (stopOnHead) return false

            await wait(headPollInterval, abortSignal)
          } else {
            // no data left
            if (res.stream == null) break

            finalizedHead = res.finalizedHead
            reader = res.stream.getReader()

            while (true) {
              const data = await withAbort(reader.read(), abortSignal)
              if (data.done) break
              if (data.value.length === 0) continue

              const blocks: R[] = []
              let bytes = 0

              for (const line of data.value) {
                const block = JSON.parse(line) as R

                blocks.push(block)
                bytes += line.length
                this.bytesReceived += line.length

                fromBlock = block.header.number + 1
                parentBlockHash = block.header.hash
              }

              await withAbort(buffer.put(blocks, bytes), abortSignal)
            }
          }

          buffer.ready()
        } catch (err) {
          if (abortSignal.aborted || isStreamAbortedError(err)) {
            // ignore
          } else {
            throw err
          }
        } finally {
          reader?.cancel().catch(() => {})
        }
      }

      return true
    }

    return new ReadableStream({
      start() {
        ingest()
          .then(() => {
            buffer.close()
          })
          .catch((err) => {
            buffer.fail(err)
          })
      },
      async pull(controller) {
        try {
          const result = await buffer.take()
          if (result.done) {
            controller.close()
            return
          }

          controller.enqueue({
            blocks: result.value,
            finalizedHead,
          })
        } catch (err) {
          controller.error(err)
        }
      },
      cancel(reason) {
        abortStream.abort(reason)
      },
    })
  }

  private async getStreamRequest(path: string, query: PortalQuery, options?: PortalRequestOptions) {
    try {
      const res = await this.request<Readable | undefined>('POST', this.getDatasetUrl(path), {
        ...options,
        json: query,
        stream: true,
      })

      switch (res.status) {
        case 200:
          const finalizedHead = getFinalizedHeadHeader(res.headers)
          if (!res.body) return { finalizedHead }

          const stream = Readable.toWeb(res.body) as ReadableStream<Uint8Array>

          return {
            finalizedHead,
            stream: stream
              .pipeThrough(new TextDecoderStream('utf8'))
              .pipeThrough(new LineSplitStream('\n')),
          }
        case 204:
          // No new blocks, need to wait
          return
        default:
          throw new Error(`Unexpected response status code: ${res.status}`)
      }
    } catch (e: unknown) {
      if (e instanceof HttpError && e.response.status === 409 && e.response.body.previousBlocks) {
        const blocks = e.response.body.previousBlocks as BlockRef[]

        e = new ForkException(blocks, {
          fromBlock: query.fromBlock,
          parentBlockHash: query.parentBlockHash,
        })
      }

      throw addErrorContext(e as any, { query })
    }
  }

  private request<T = any>(method: string, url: string, options: RequestOptions & HttpBody = {}) {
    return this.client.request<T>(method, url, {
      ...options,
      headers: {
        'User-Agent': USER_AGENT,
        ...options?.headers,
      },
    })
  }

  getStats(): PortalStats {
    return {
      bytesReceived: this.bytesReceived,
    }
  }
}

function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason || new Error('Aborted'))
    }

    signal.addEventListener('abort', abort, { once: true })

    function abort() {
      reject(signal.reason || new Error('Aborted'))
    }

    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', abort)
    })
  })
}

function getFinalizedHeadHeader(headers: HttpResponse['headers']) {
  const finalizedHeadHash = headers.get('X-Sqd-Finalized-Head-Hash')
  const finalizedHeadNumber = headers.get('X-Sqd-Finalized-Head-Number')

  return finalizedHeadHash != null && finalizedHeadNumber != null
    ? {
        hash: finalizedHeadHash,
        number: parseInt(finalizedHeadNumber),
      }
    : undefined
}

function isStreamAbortedError(err: unknown) {
  if (!(err instanceof Error)) return false
  if (!('code' in err)) return false

  switch (err.code) {
    case 'ABORT_ERR':
    case 'ERR_STREAM_PREMATURE_CLOSE':
    case 'ECONNRESET':
      return true
    default:
      return false
  }
}
