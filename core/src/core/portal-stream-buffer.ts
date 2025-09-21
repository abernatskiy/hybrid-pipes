import { createFuture, Future } from '@subsquid/util-internal'

export class PortalStreamBuffer<B> {
  private buffer: { blocks: B[]; bytes: number } | undefined
  private state: 'open' | 'failed' | 'closed' = 'open'
  private error: unknown

  private readyFuture: Future<void> = createFuture()
  private takeFuture: Future<void> = createFuture()
  private putFuture: Future<void> = createFuture()

  private lastChunkTimestamp = Date.now()
  private idleInterval: ReturnType<typeof setInterval> | undefined

  private readonly minBytes: number
  private readonly maxBytes: number
  private readonly maxIdleTime: number
  private readonly maxWaitTime: number

  constructor(options: {
    maxWaitTime: number
    maxBytes: number
    maxIdleTime: number
    minBytes: number
  }) {
    this.maxWaitTime = options.maxWaitTime
    this.minBytes = options.minBytes
    this.maxBytes = Math.max(options.maxBytes, options.minBytes)
    this.maxIdleTime = options.maxIdleTime
  }

  async take(): Promise<{ done: true; value?: undefined } | { value: B[]; done: false }> {
    const waitTimeout = setTimeout(() => {
      this.readyFuture.resolve()
    }, this.maxWaitTime)
    this.readyFuture.promise().finally(() => clearTimeout(waitTimeout))

    await Promise.all([this.readyFuture.promise(), this.putFuture.promise()])

    if (this.state === 'failed') {
      throw this.error
    }

    const value = this.buffer?.blocks
    this.buffer = undefined

    this.takeFuture.resolve()

    if (this.state === 'closed') {
      return value == null ? { done: true } : { value, done: false }
    } else {
      if (value == null) {
        throw new Error('buffer is empty')
      }

      this.takeFuture = createFuture()
      this.putFuture = createFuture()
      this.readyFuture = createFuture()

      return { value, done: false }
    }
  }

  async put(blocks: B[], bytes: number) {
    if (this.state !== 'open') {
      throw new Error('buffer is closed')
    }

    this.lastChunkTimestamp = Date.now()
    if (this.idleInterval == null) {
      this.idleInterval = setInterval(
        () => {
          if (Date.now() - this.lastChunkTimestamp >= this.maxIdleTime) {
            this.readyFuture.resolve()
          }
        },
        Math.ceil(this.maxIdleTime / 3),
      )
      this.readyFuture.promise().finally(() => clearInterval(this.idleInterval))
      this.takeFuture.promise().finally(() => (this.idleInterval = undefined))
    }

    if (this.buffer == null) {
      this.buffer = {
        blocks: [],
        bytes: 0,
      }
    }

    this.buffer.bytes += bytes
    this.buffer.blocks.push(...blocks)

    this.putFuture.resolve()

    if (this.buffer.bytes >= this.minBytes) {
      this.readyFuture.resolve()
    }

    if (this.buffer.bytes >= this.maxBytes) {
      await this.takeFuture.promise()
    }
  }

  ready() {
    if (this.buffer == null) return
    this.readyFuture.resolve()
  }

  close() {
    if (this.state !== 'open') return
    this.state = 'closed'
    this.readyFuture.resolve()
    this.putFuture.resolve()
    this.takeFuture.resolve()
  }

  fail(err: unknown) {
    if (this.state !== 'open') return
    this.state = 'failed'
    this.error = err
    this.readyFuture.resolve()
    this.putFuture.resolve()
    this.takeFuture.resolve()
  }
}
