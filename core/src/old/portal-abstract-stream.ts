import EventEmitter from 'node:events'
import { ReadableStream } from 'node:stream/web'
import { Throttler } from '@subsquid/util-internal'
import pino from 'pino'
import { BlockCursor, Logger } from '../core'
import { displayEstimatedTime, formatNumber, humanBytes, lines, parseBlockNumber } from '../core/formatters'
import {
  evm,
  GetBlock,
  PortalClient,
  type PortalClientOptions,
  PortalStreamData,
  solana,
  substrate,
} from '../portal-client'
import { isForkException } from '../portal-client/fork-exception'
import type { State } from './state'
import { ProgressState, TrackProgress } from './track-progress'

export type TransactionRef = {
  hash: string
  index: number
}

export type StartState = {
  state?: State
  current: Offset
  initial: Offset
  resume: boolean
}

export type StreamOptions<Args extends object | undefined = undefined> = {
  portal: string | PortalClientOptions
  blockRange: {
    from: number | string
    to?: number | string
  }
  state?: State
  logger?: Logger
  args?: Args
  onProgress?: (progress: ProgressState) => Promise<unknown> | unknown
  onStart?: (state: StartState) => Promise<unknown> | unknown
} & (Args extends object ? { args: Args } : { args?: never })

const logged = new Map()

export type Offset = {
  number: number
  timestamp?: number | undefined
  hash?: string
}

export type UnfinalizedOffset = {
  latest: Offset
  chain_continuity: BlockCursor[]
  finalized?: Omit<BlockCursor, 'timestamp'>
}

export type OptionalArgs<T> = T | undefined

export abstract class PortalAbstractStream<
  Res extends {},
  Args extends object | undefined = undefined,
> extends EventEmitter {
  logger: Logger
  progress?: TrackProgress

  protected readonly portal: PortalClient

  private offsets: UnfinalizedOffset[] = []
  private readonly getLatestOffset: () => Promise<Offset>

  protected fromBlock: number
  protected toBlock: number | undefined

  protected hooks: {
    onStart?: (state: StartState) => Promise<unknown> | unknown
    onProgress?: (state: ProgressState) => Promise<unknown> | unknown
  }

  constructor(protected readonly options: StreamOptions<Args>) {
    super()

    this.logger =
      options.logger ||
      pino({
        base: null,
        messageKey: 'message',
        level: process.env.LOG_LEVEL || 'info',
      })

    this.portal = new PortalClient(
      typeof options.portal === 'string'
        ? {
            url: options.portal,
            http: {
              retryAttempts: 10,
            },
          }
        : {
            ...options.portal,
            http: {
              retryAttempts: 10,
              ...options.portal.http,
            },
          },
    )

    // Throttle the head call
    const portalApiHeadCall = new Throttler(() => this.portal.getHead(), 60_000)

    this.fromBlock = parseBlockNumber(this.options.blockRange.from)
    this.toBlock = this.options.blockRange.to ? parseBlockNumber(this.options.blockRange.to) : undefined

    // Get the latest offset
    this.getLatestOffset = async () => {
      if (this.toBlock) {
        return {
          number: this.toBlock,
          timestamp: 0,
        }
      }

      const latest = await portalApiHeadCall.get()

      const lastOffest = this.offsets[this.offsets.length - 1]

      return {
        number: Math.max(lastOffest?.latest.number || 0, latest?.number || 0),
        // FIXME extract timestamp from the block?
        timestamp: 0,
      }
    }

    // Inherit logger to the state
    if (this.options.state && !this.options.state.logger) {
      this.options.state.setLogger(this.logger)
    }

    this.hooks = {
      onStart:
        options.onStart ||
        (({ current, resume }) => {
          if (!resume) {
            this.logger.info(`Syncing from ${formatNumber(current.number)}`)
            return
          }

          const producedAt = current.timestamp
            ? new Date(current.timestamp * 1000).toLocaleString('en-GB', {
                dateStyle: 'medium',
                timeStyle: 'long',
              })
            : null
          this.logger.info(
            `Resuming from ${formatNumber(current.number + 1)} block ${producedAt ? `produced at ${producedAt}` : ''}`,
          )
        }),
      onProgress:
        options.onProgress ||
        (({ state, interval }) => {
          const blocksPerSecond =
            interval.processedBlocks.perSecond > 10
              ? Math.floor(interval.processedBlocks.perSecond)
              : interval.processedBlocks.perSecond.toFixed()

          const diff = state.last - state.current

          const etaSeconds =
            interval.processedBlocks.perSecond > 0 ? diff / interval.processedBlocks.perSecond : undefined

          this.logger.info({
            message: `${formatNumber(state.current)} / ${formatNumber(state.last)} (${formatNumber(state.percent)}%), ${displayEstimatedTime(etaSeconds)}`,
            blocks: `${blocksPerSecond} blocks/second`,
            bytes: `${humanBytes(interval.bytesDownloaded.perSecond)}/second`,
          })
        }),
    }
  }

  abstract stream(): Promise<ReadableStream<Res[]>>

  warnOnlyOnce(message: string) {
    if (logged.has(message)) return

    this.logger.warn(message)

    logged.set(message, true)
  }

  // FIXME types
  /**
   * Fetches the stream of data from the portal.
   *
   * This method retrieves a stream of data from the portal based on the provided query.
   * It resumes streaming from the last saved offset and exits when the stream is completed.
   *
   * @param req - The query object containing the parameters for the stream request.
   * @returns A promise that resolves to a ReadableStream of the portal stream data.
   */
  async getStream<Query extends evm.Query | solana.Query | substrate.Query>(
    req: Query,
  ): Promise<ReadableStream<PortalStreamData<GetBlock<Query>>>> {
    // Get the last offset from the state
    const { latest, initial, resume } = await this.getState({
      number: this.fromBlock,
      timestamp: undefined,
    })

    this.hooks.onStart?.({
      state: this.options.state,
      current: latest,
      initial,
      resume,
    })

    if (this.hooks.onProgress) {
      this.progress = new TrackProgress({
        getLatestOffset: this.getLatestOffset,
        onProgress: this.hooks.onProgress,
        initial,
      })
    }

    await this.options.state?.onRollback?.({
      type: 'offset_check',
      expectedLatestOffset: latest,
    })

    // Ensure required block fields are present
    req.fields = {
      ...req.fields,
      block: {
        ...req.fields?.block,
        number: true,
        hash: true,
        timestamp: true,
      },
    }

    const fromBlock = resume ? latest.number + 1 : latest.number

    let source = this.portal.getStream<Query>({
      ...req,
      // We need to process from the next block in case of stop
      fromBlock,
      toBlock: this.toBlock,
      // Apply previous block hash
      parentBlockHash: latest.hash && resume ? latest.hash : undefined,
    })

    let reader = ReadableStream.from(source).getReader()

    return new ReadableStream({
      pull: async (controller) => {
        try {
          const res = await reader.read()
          if (res.done) {
            this.stop()
            controller.close()
            return
          }

          const data = res.value

          const lastBlock = data.blocks[data.blocks.length - 1]
          const finalizedHeadNumber = data.finalizedHead?.number || -1

          const offset = {
            latest: {
              number: lastBlock.header.number,
              hash: lastBlock.header.hash,
              timestamp: lastBlock.header.timestamp,
            },
            finalized: data.finalizedHead,
            chain_continuity:
              finalizedHeadNumber >= 0
                ? data.blocks
                    .filter((b) => b.header.number >= finalizedHeadNumber)
                    .map((b) => ({
                      number: b.header.number,
                      hash: b.header.hash,
                      timestamp: b.header.timestamp,
                    }))
                    .sort((a, b) => b.number - a.number)
                : [],
          }

          this.offsets.push(offset)

          const from = formatNumber(data.blocks[0].header.number)
          const to = formatNumber(lastBlock.header.number)

          this.logger.debug(`Enqueuing chunks from ${from} / ${to}`)

          controller.enqueue(data)
        } catch (err) {
          if (!isForkException(err)) {
            controller.error(err)
            return
          }

          // State manager is not configured, we can't manage forks
          if (!this.options.state || !this.options.state.onRollback) {
            controller.error(err)
            return
          }

          // The most old blocks should be first
          const blocks = err.previousBlocks.sort((a, b) => b.number - a.number)

          this.logger.info(`Fork is detected on block ${formatNumber(blocks[0].number + 1)}`)

          /**
           *  We must wait until everything in memory is acked,
           *  otherwise we may not roll back all the data or simply
           */
          // FIXME what id there is no processing blocks?
          if (this.offsets.length) {
            await new Promise((resolve) => {
              this.once('drain', resolve)
            })
          }
          this.logger.debug('All batches have been processed')

          const block = await this.options.state.onRollback({
            type: 'blockchain_fork',
            canonicalBlocks: blocks,
          })

          const fromBlock = block.number + 1

          this.logger.debug(
            `Restarting streaming from unforked block ${formatNumber(fromBlock)} with hash ${block.hash}`,
          )

          source = this.portal.getStream<Query>({
            ...req,
            // We need to process form the next block in case of stop
            fromBlock: fromBlock,
            toBlock: this.toBlock,
            parentBlockHash: block.hash,
          })

          reader = ReadableStream.from(source).getReader()
        }
      },
    })
  }

  /**
   * Fetches the current state of the stream.
   *
   * This method retrieves the last offset from the state, initializes progress tracking,
   * and calls the onStart callback with the current and initial offsets.
   *
   * @param defaultValue - The default offset value to use if no state is found.
   * @returns The current offset.
   */
  async getState(defaultValue: Offset): Promise<{ latest: Offset; initial: Offset; resume: boolean }> {
    // Fetch the last offset from the state
    const state = this.options.state ? await this.options.state.getOffset(defaultValue) : null
    if (!state) {
      return {
        latest: defaultValue,
        initial: defaultValue,
        resume: false,
      }
    }

    return { ...state, resume: true }
  }

  /**
   * Acknowledge the last offset.
   *
   * This method is called to acknowledge the last processed offset in the stream.
   * It updates the progress tracking and saves the last offset to the state.
   *
   * @param args - Additional arguments passed to the state saveOffset method.
   */
  async ack<T extends any[]>(...args: T) {
    const offset = this.offsets.shift()
    if (!offset) {
      throw new Error(
        lines([
          'Failed to acknowledge offset: no pending offsets in the queue.',
          'This usually means ack() was called more times than data was processed.',
        ]),
      )
    }

    // Calculate progress and speed
    // FIXME meta
    this.progress?.track(offset.latest, { bytesReceived: 0 })

    if (!this.options.state) {
      this.warnOnlyOnce(
        lines([
          '====================================',
          'State is not defined. Please set a state to make a stream resumable',
          '====================================',
        ]),
      )
      return
    }
    // Save last offset
    await this.options.state.commitOffset(offset)

    this.logger.debug(`Acked blocks ${formatNumber(offset.latest.number)}`)

    if (this.offsets.length === 0) {
      this.emit('drain')
    }
  }

  stop() {
    this.progress?.stop()

    this.logger.info('Stream stopped')
  }
}
