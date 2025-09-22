import { BlockCursor } from '../../core'
import { ClickhouseStore } from './clickhouse-store'

// FIXME: we need refactor it to make order more deterministic and predictable.
// ORDER BY (timestamp, id) isn't a good choice
const table = (table: string) => `
CREATE TABLE IF NOT EXISTS ${table}
(
    id               String COMMENT 'Stream identifier to differentiate multiple logical streams',
    current          String COMMENT 'Current offset, corresponds to the most recent indexed block',
    finalized        String COMMENT 'Finalized offset, usually corresponds to the most recent known block',
    initial          String COMMENT 'The very first offset from which this stream started tracking',
    chain_continuity String COMMENT 'JSON-encoded list of block references starting from the finalized block and including all unfinalized blocks',
    timestamp        DateTime(3) COMMENT 'Timestamp of the record, in milliseconds with 3 decimal precision',
    sign             Int8 COMMENT 'Marker used by CollapsingMergeTree to distinguish insertions (+1) and deletions (-1)'
) ENGINE = CollapsingMergeTree(sign)
  ORDER BY (timestamp, id)
`

/**
 * Configuration options for ClickhouseState.
 */
export type Options = {
  /**
   * Name of the ClickHouse database to use.
   * Defaults to "default" if not provided.
   */
  database?: string

  /**
   * Name of the table to store offset data.
   */
  table?: string

  /**
   * Stream identifier used to isolate offset records within the same table.
   * Defaults to "stream" if not provided.
   */
  id?: string

  /**
   * Maximum number of rows to retain per unique stream id in the offset table.
   * Older rows beyond this count will be removed.
   * Default is 10,000.
   */
  maxRows?: number
}

export class ClickhouseState {
  options: Options & Required<Pick<Options, 'database' | 'id' | 'table'>>

  initial?: string

  readonly #fullTableName: string

  constructor(
    private store: ClickhouseStore,
    options: Options,
  ) {
    this.options = {
      database: 'default',
      table: 'sync',
      id: 'stream',
      maxRows: 10_000,

      ...options,
    }

    if (this.options?.maxRows && this.options?.maxRows <= 0) {
      throw new Error('Max rows must be greater than 0')
    }

    this.#fullTableName = `"${this.options.database}"."${this.options.table}"`
  }

  encodeCursor(cursor: BlockCursor | { number: number }): string {
    return JSON.stringify(cursor)
  }
  decodeCursor(cursor: string): BlockCursor {
    return JSON.parse(cursor)
  }

  async saveCursor({
    cursor: { current, unfinalized, initial },
    head,
  }: {
    cursor: {
      initial: { number: number }
      current: BlockCursor
      unfinalized: BlockCursor[]
    }
    head: {
      finalized?: BlockCursor
    }
  }) {
    const timestamp = Date.now()

    await this.store.insert({
      table: this.options.table,
      values: [
        {
          id: this.options.id,
          initial: this.initial ? this.initial : JSON.stringify(initial),
          current: this.encodeCursor(current),
          finalized: head.finalized ? this.encodeCursor(head.finalized) : '',
          chain_continuity: JSON.stringify(unfinalized),
          sign: 1,
          timestamp,
        },
      ],
      format: 'JSONEachRow',
    })

    // const count = await this._removeAllRows({
    //     table: this.options.table,
    //     query: `
    //     SELECT *
    //     FROM ${this.options.table} FINAL
    //     ORDER BY "timestamp" DESC
    //     OFFSET ${this.options.settings?.maxRows}
    // `,
    // })

    // this.options.logger?.debug(`Removed unused offsets from ${count} rows from ${this.options.table}`)
  }

  async getCursor(): Promise<{ current: BlockCursor; initial: BlockCursor } | undefined> {
    try {
      const res = await this.store.query({
        query: `SELECT * FROM ${this.#fullTableName} WHERE id = {id:String} ORDER BY timestamp DESC LIMIT 1`,
        format: 'JSONEachRow',
        query_params: { id: this.options.id },
      })

      const [row] = await res.json<{ current: string; initial: string }>()
      if (row) {
        this.initial = row.initial

        return {
          current: this.decodeCursor(row.current),
          initial: this.decodeCursor(row.initial),
        }
      }

      return
    } catch (e: unknown) {
      if (e instanceof Error && 'type' in e && e.type === 'UNKNOWN_TABLE') {
        await this.store.command({ query: table(this.#fullTableName) })

        return
      }

      throw e
    }
  }

  async fork(unforked: BlockCursor[]): Promise<BlockCursor | null> {
    const res = await this.store.query({
      query: `SELECT * FROM ${this.#fullTableName} ORDER BY "timestamp" DESC`,
      format: 'JSONEachRow',
    })

    for await (const rows of res.stream<{ chain_continuity: string }>()) {
      for (const row of rows) {
        const raw = row.json()

        const blocks = JSON.parse(raw.chain_continuity) as BlockCursor[]
        if (!blocks.length) continue

        for (const block of blocks) {
          const found = unforked.find((u) => u.number === block.number && u.hash === block.hash)
          if (found) return found

          // Remove already visited blocks
          unforked = unforked.filter((u) => u.number < block.number)
          if (!unforked.length) return null
        }
      }
    }

    return null
  }
}
