import { Gauge } from 'prom-client'

import { createTransformer } from './transformer'
import { CursorState } from './types'

type HistoryState = { ts: number; bytesDownloaded: number; blockNumber: number }
type LastCursorState = CursorState & { last: number }

export type ProgressState = {
  state: {
    initial: number
    last: number
    current: number
    percent: number
    etaSeconds: number
  }
  interval: {
    processedBlocks: {
      count: number
      perSecond: number
    }
    bytesDownloaded: {
      count: number
      perSecond: number
    }
  }
}

type ProgressHistoryOptions = {
  maxHistory?: number
  maxStaleSeconds?: number
}

class ProgressHistory {
  #options: Required<ProgressHistoryOptions>
  #states: HistoryState[] = []
  #lastCursorState?: LastCursorState

  constructor(options?: ProgressHistoryOptions) {
    this.#options = {
      maxHistory: 50,
      maxStaleSeconds: 30,

      ...options,
    }
  }

  addState({ bytes, state }: { bytes: number; state: LastCursorState }) {
    this.#states.push({
      ts: Date.now(),
      bytesDownloaded: bytes,
      blockNumber: state.current?.number || 0,
    })

    this.#lastCursorState = state

    // Keep only the last N states for X seconds
    this.#states = this.#states.slice(-this.#options.maxHistory)
  }

  private validateHistory(states: HistoryState[]) {
    const lastTs = states[states.length - 1]?.ts

    // If the last state is too old, reset the history
    // This can happen if the stream got stuck
    if (lastTs && Date.now() - lastTs > this.#options.maxStaleSeconds * 1000) {
      this.#states = []
      return { blocks: 0, bytes: 0 }
    }

    return {
      blocks: states.length >= 2 ? states[states.length - 1].blockNumber - states[0].blockNumber : 0,
      bytes: states.reduce((acc, state) => acc + state.bytesDownloaded, 0),
    }
  }

  calculate(): ProgressState {
    const stat = this.validateHistory(this.#states)

    const last = this.#lastCursorState?.last || 0
    const initial = this.#lastCursorState?.initial?.number || 0
    const current = this.#lastCursorState?.current?.number || 0

    const blocksTotal = Math.max(last - initial, 0)
    const blocksProcessed = Math.max(current - initial, 0)
    const blocksRemaining = Math.max(last - current, 0)

    const secsDiff = this.#states[0] ? (Date.now() - this.#states[0].ts) / 1000 : 0
    const blockPerSecond = secsDiff > 0 ? stat.blocks / secsDiff : 0

    return {
      state: {
        initial: this.#lastCursorState?.initial?.number || 0,
        last: this.#lastCursorState?.last || 0,
        current: this.#lastCursorState?.current?.number || 0,
        percent: blocksTotal > 0 ? (blocksProcessed / blocksTotal) * 100 : 0,
        etaSeconds: blockPerSecond > 0 ? blocksRemaining / blockPerSecond : 0,
      },
      interval: {
        processedBlocks: {
          count: stat.blocks,
          perSecond: blockPerSecond,
        },
        bytesDownloaded: {
          count: stat.bytes,
          perSecond: secsDiff > 0 ? stat.bytes / secsDiff : 0,
        },
      },
    }
  }
}

export function progressTracker<T>({ onProgress }: { onProgress: (progress: ProgressState) => void | false }) {
  let ticker: NodeJS.Timeout
  const interval = 5000
  const history = new ProgressHistory()

  let currentBlock: Gauge

  return createTransformer<T, T>({
    profiler: { id: 'progress_tracker' },
    start: ({ metrics }) => {
      ticker = setInterval(() => onProgress(history.calculate()), interval)

      currentBlock = metrics.gauge({
        name: 'sqd_current_block',
        help: 'Total number of blocks processed',
      })
      currentBlock.set(-1)
    },
    transform: async (data, ctx) => {
      history.addState({
        state: {
          ...ctx.cursor,
          last: Math.min(ctx.query.toBlock || Infinity, ctx.head.finalized?.number || Infinity),
        },
        bytes: ctx.bytes,
      })

      if (ctx.cursor.current?.number) {
        currentBlock.set(ctx.cursor.current.number)
      }

      return data
    },
    stop: () => {
      clearInterval(ticker)
    },
  })
}
