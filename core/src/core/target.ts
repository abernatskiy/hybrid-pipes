import { PortalBatch } from './portal-source'
import { BlockCursor, Ctx } from './types'

export type Target<In> = {
  write: (writer: {
    read: (cursor?: { initial?: BlockCursor; current?: BlockCursor }) => AsyncIterableIterator<PortalBatch<In>>
    ctx: Ctx
  }) => Promise<void>
  fork?: (cursor?: BlockCursor[]) => Promise<BlockCursor | null>
}

export function createTarget<In>(options: Target<In>): Target<In> {
  return options
}
