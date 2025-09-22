import pino from 'pino'
import { Profiler } from './profiling'

import Logger = pino.Logger

export type BlockCursor = {
  number: number
  hash: string
  timestamp?: number
}

export type CursorState = { initial?: BlockCursor; current?: BlockCursor }

// TODO do we need?
export interface Source<T> {
  // read(cursor?: Cursor): AsyncIterable<T>
  [Symbol.asyncIterator](): AsyncIterator<T>
}

export type Ctx = { logger: Logger; profiler: Profiler }
