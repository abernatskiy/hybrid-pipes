import type { Offset, ProgressState } from './portal-abstract-stream'
import { PortalStats } from './portal-client'

export type TrackProgressOptions = {
  intervalSeconds?: number
  getLatestOffset: () => Promise<Offset>
  onProgress: (progress: ProgressState) => void
  initial?: Offset
}

export type TrackProgressTick = { offset: Offset; stats: PortalStats; ts: number }

export class TrackProgress {
  initial?: TrackProgressTick
  last?: TrackProgressTick
  current?: TrackProgressTick
  interval?: NodeJS.Timeout

  stopped = false

  constructor(private options: TrackProgressOptions) {
    if (options.initial) {
      this.initial = { offset: options.initial, stats: { bytesReceived: 0 }, ts: Date.now() }
    }
  }

  track(offset: Offset, stats: PortalStats) {
    if (!this.initial) {
      this.initial = { offset, stats, ts: Date.now() }
    }
    this.current = { offset, stats, ts: Date.now() }

    if (this.interval || this.stopped) return

    const { intervalSeconds = 5, onProgress } = this.options

    this.interval = setInterval(async () => {
      if (!this.current || !this.initial) return

      const last = await this.options.getLatestOffset()

      const elapsed = this.last ? (Date.now() - this.last.ts) / 1000 : 0

      const blocksProcessed = this.last ? this.current.offset.number - this.last.offset.number : 0
      const bytesDownloaded = this.last
        ? this.current.stats.bytesReceived - this.last.stats.bytesReceived
        : 0

      const diffFromStart = this.current.offset.number - this.initial?.offset.number
      const diffToEnd = last.number - this.initial.offset.number

      onProgress({
        state: {
          last: last.number,
          initial: this.initial.offset.number,
          current: this.current.offset.number,
          percent: (diffFromStart / diffToEnd) * 100,
        },
        interval: {
          processedBlocks: {
            count: blocksProcessed,
            perSecond: elapsed ? blocksProcessed / elapsed : 0,
          },
          bytesDownloaded: {
            count: bytesDownloaded,
            perSecond: elapsed ? Math.floor(bytesDownloaded / elapsed) : 0,
          },
        },
      })

      this.last = this.current
    }, intervalSeconds * 1000)
  }

  stop() {
    this.stopped = true
    clearInterval(this.interval)
  }
}
