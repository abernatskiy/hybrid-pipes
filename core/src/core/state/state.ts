import { Logger, Offset, UnfinalizedOffset } from '../portal-abstract-stream'
import { BlockRef } from '../portal-client'

export interface State<Args extends any[] = any[]> {
  logger?: Logger

  setLogger(logger: Logger): void

  commitOffset(offset: UnfinalizedOffset, ...args: Args): Promise<unknown>

  getOffset(v: Offset): Promise<{ latest: Offset; initial: Offset } | undefined>

  onRollback?(
    event: /** Triggered when a rollback is needed.
     *
     *   Occurs during a normal blockchain fork.
     *   The canonical chain is represented by `canonicalBlocks`.
     */
      | { type: 'blockchain_fork'; canonicalBlocks: BlockRef[] }
      /**
       *
       * Used to ensure that the latest acknowledged offset matches the data actually stored.
       * In systems where atomic transactions aren't guaranteed,
       * it's possible to persist data but fail to save the associated offset.
       * This requires rolling back the data to the known valid state.
       */
      | { type: 'offset_check'; expectedLatestOffset: Offset },
  ): Promise<Offset>
}

export abstract class AbstractState {
  logger?: Logger
  onRollback?: State['onRollback']

  setLogger(logger: Logger) {
    this.logger = logger
  }

  encodeOffset(offset: Offset): string {
    return JSON.stringify(offset)
  }

  decodeOffset(offset: string): Offset {
    return {
      timestamp: 0,
      number: 0,
      hash: '',
      ...(JSON.parse(offset || '{}') || {}),
    }
  }
}
