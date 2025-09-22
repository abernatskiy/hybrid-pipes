import { last } from '../internal/array'
import { createPortalCache, PortalCacheOptions } from '../portal-cache/portal-cache'
import { isForkException, PortalClient, PortalClientOptions } from '../portal-client'
import { displayEstimatedTime, formatNumber, humanBytes } from './formatters'
import { createDefaultLogger, Logger } from './logger'
import { Profiler, Span } from './profiling'
import { progressTracker } from './progress-tracker'
import { createPrometheusMetrics, Metrics } from './prometheus-metrics'
import { QueryBuilder } from './query-builder'
import { Target } from './target'
import { ExtensionOut, extendTransformer, Transformer } from './transformer'
import { BlockCursor, Ctx, CursorState } from './types'

export type PortalCtx = {
  head: {
    finalized?: BlockCursor
    unfinalized?: BlockCursor
  }
  cursor: {
    initial: BlockCursor
    current: BlockCursor
    unfinalized: BlockCursor[]
  }
  bytes: number
  query: any
  profiler: Profiler
  metrics: Metrics
}

export type PortalBatch<T = any> = { data: T; ctx: PortalCtx }

export function cursorFromHeader(block: { header: { number: number; hash: string; timestamp?: number } }): BlockCursor {
  return { number: block.header.number, hash: block.header.hash, timestamp: block.header.timestamp }
}

export type PortalSourceOptions<Query> = {
  portal: string | PortalClientOptions | PortalClient
  query: Query
  logger?: Logger
  profiler?: boolean
  cache?: PortalCacheOptions
  progress?: Transformer<any, any>
}

export class PortalSource<Q extends QueryBuilder = any, T = any> {
  readonly #options: {
    profiler: boolean
    cache?: PortalCacheOptions
  }
  readonly #queryBuilder: Q
  readonly #logger: Logger
  readonly #portal: PortalClient
  readonly #metrics: Metrics

  #locked = false
  #transformers: Transformer<any, any>[] = []

  constructor({ portal, query, logger, ...options }: PortalSourceOptions<Q>) {
    this.#portal =
      portal instanceof PortalClient
        ? portal
        : new PortalClient(
            typeof portal === 'string'
              ? {
                  url: portal,
                  http: {
                    retryAttempts: Number.MAX_SAFE_INTEGER,
                  },
                }
              : {
                  ...portal,
                  http: {
                    retryAttempts: Number.MAX_SAFE_INTEGER,
                    ...portal.http,
                  },
                },
          )

    this.#queryBuilder = query
    this.#logger = logger || createDefaultLogger()
    this.#options = {
      ...options,
      profiler: typeof options.profiler === 'undefined' ? process.env.NODE_ENV !== 'production' : options.profiler,
    }
    this.#metrics = createPrometheusMetrics()

    this.#transformers.push(
      progressTracker({
        onProgress: ({ state, interval }) => {
          this.#logger.info({
            message: `${formatNumber(state.current)} / ${formatNumber(state.last)} (${formatNumber(state.percent)}%), ${displayEstimatedTime(state.etaSeconds)}`,
            blocks: `${interval.processedBlocks.perSecond.toFixed(interval.processedBlocks.perSecond > 1 ? 0 : 1)} blocks/second`,
            bytes: `${humanBytes(interval.bytesDownloaded.perSecond)}/second`,
          })
        },
      }),
    )
  }

  async *read({ initial, current }: CursorState = {}): AsyncIterable<PortalBatch<T>> {
    if (this.#locked) {
      throw new Error(`Source is locked`)
    }

    await this.configure()
    await this.start()

    const bound = current ? { from: current.number + 1 } : undefined

    for (const { range, request } of this.#queryBuilder.calculateRanges(bound)) {
      const query = {
        ...request,
        type: this.#queryBuilder.getType(),
        fields: this.#queryBuilder.getFields(),
        fromBlock: range.from,
        toBlock: range.to,
        parentBlockHash: current?.hash ? current.hash : undefined,
      }

      const source = this.#options.cache
        ? await createPortalCache({
            ...this.#options.cache,
            portal: this.#portal,
            logger: this.#logger,
            query,
          })
        : this.#portal.getStream(query)

      let batchSpan = Span.root('batch', this.#options.profiler)
      let readSpan = batchSpan.start('fetch data')
      for await (const rawBatch of source) {
        readSpan.end()

        if (rawBatch.blocks.length > 0) {
          const lastBlock = last(rawBatch.blocks as any)
          const finalized = rawBatch.finalizedHead?.number

          const ctx: PortalCtx = {
            head: {
              finalized: rawBatch.finalizedHead,
              // TODO expose from portal
              unfinalized: undefined,
            },
            metrics: this.#metrics,
            bytes: rawBatch.meta.bytes,
            cursor: {
              initial: initial || { number: range.from, hash: '' },
              current: cursorFromHeader(lastBlock as any),
              unfinalized: finalized
                ? rawBatch.blocks.filter((b) => b.header.number > finalized).map(cursorFromHeader)
                : [],
            },
            profiler: batchSpan,
            query,
          }

          const data = await this.applyTransformers(ctx, { blocks: rawBatch.blocks } as T)

          yield { data, ctx }
        }

        batchSpan = Span.root('batch', this.#options.profiler)
        readSpan = batchSpan.start('fetch data')
      }
    }

    await this.stop()
  }

  pipe<Out>(transformer: Transformer<T, Out>): PortalSource<Q, Out> {
    if (this.#locked) throw new Error('Source closed')

    this.#transformers.push(transformer)

    return this as unknown as PortalSource<Q, Out>
  }

  extend<Arg extends Record<string, Transformer<any, any>>>(extend: Arg): PortalSource<Q, ExtensionOut<T, Arg>> {
    return this.pipe(extendTransformer(extend))
  }

  async applyTransformers(ctx: PortalCtx, data: T) {
    const span = ctx.profiler.start('transformers')

    for (const transformer of this.#transformers) {
      data = await transformer.transform(data, {
        ...ctx,
        profiler: span,
        logger: this.#logger,
      })
    }
    span.end()

    return data
  }

  context<T extends Record<string, any>>(span: Profiler, rest?: T) {
    return {
      logger: this.#logger,
      profiler: span,
      ...rest,
    } as Ctx & T
  }

  async forkTransformers(profiler: Profiler, cursor: BlockCursor) {
    const span = profiler.start('transformers_rollback')
    const ctx = this.context(span)
    await Promise.all(this.#transformers.map((t) => t.fork(cursor, ctx)))
    span.end()
  }

  async configure() {
    const profiler = Span.root('configure', this.#options.profiler)

    const span = profiler.start('transformers')
    const ctx = this.context(span, {
      queryBuilder: this.#queryBuilder,
      portal: this.#portal,
      logger: this.#logger,
    })
    await Promise.all(this.#transformers.map((t) => t.query(ctx)))
    span.end()

    profiler.end()
  }

  async start() {
    this.#locked = true

    const profiler = Span.root('start', this.#options.profiler)

    const span = profiler.start('transformers')
    const ctx = this.context(span, { metrics: this.#metrics })
    await Promise.all(this.#transformers.map((t) => t.start(ctx)))
    span.end()

    this.#metrics.start()

    profiler.end()
  }

  async stop() {
    this.#locked = false

    const profiler = Span.root('stop', this.#options.profiler)

    const span = profiler.start('transformers')
    const ctx = this.context(span)
    await Promise.all(this.#transformers.map((t) => t.stop(ctx)))
    span.end()

    await this.#metrics.stop()

    profiler.end()
  }

  pipeTo(target: Target<T>) {
    const self = this

    return target.write({
      ctx: this.context(Span.root('write', this.#options.profiler)),
      read: async function* (state: CursorState = {}) {
        try {
          for await (const batch of self.read(state)) {
            yield batch as PortalBatch<T>

            batch.ctx.profiler.end()
          }
        } catch (e) {
          if (!isForkException(e)) throw e
          else if (!target.fork) throw new Error('Target does not support fork')

          const forkProfiler = Span.root('fork', self.#options.profiler)

          const span = forkProfiler.start('target_rollback')
          const forkedCursor = await target.fork(e.previousBlocks)
          span.end()

          if (!forkedCursor) {
            // TODO how to explain this error? what to do next?
            throw Error(`Fork has been detected, but pipeline couldn't find the cursor to continue from`)
          }

          await self.forkTransformers(forkProfiler, forkedCursor)

          state.current = forkedCursor
        }
      },
    })
  }

  async *[Symbol.asyncIterator](): AsyncIterator<PortalBatch<T>> {
    for await (const batch of this.read()) {
      batch.ctx.profiler.end()
      yield batch
    }
  }
}
