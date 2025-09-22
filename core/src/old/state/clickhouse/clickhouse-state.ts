import { ClickHouseClient } from '@clickhouse/client'
import { Logger } from '../../../core/logger'
import { BlockCursor } from '../../../core/types'
import { Offset, UnfinalizedOffset } from '../../../old/portal-abstract-stream'
import { AbstractState, type State } from '../state'

// FIXME: we need refactor it to make order more deterministic and predictable.
// ORDER BY (timestamp, id) isn't a good choice
const table = (table: string) => `
CREATE TABLE IF NOT EXISTS ${table}
(
    id               String COMMENT 'Stream identifier to differentiate multiple logical streams',
    latest           String COMMENT 'Latest offset (usually corresponds to the most recent known block)',
    initial          String COMMENT 'The first offset from which this stream started tracking',
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
  table: string

  /**
   * Stream identifier used to isolate offset records within the same table.
   * Defaults to "stream" if not provided.
   */
  id?: string

  /**
   * Optional logger instance used for logging internal actions.
   */
  logger?: Logger

  /**
   * Optional rollback handler called when a rollback event occurs.
   */
  onRollback?: (rollback: { state: ClickhouseState; latest: Offset }) => Promise<unknown> | unknown

  /**
   * Optional advanced settings.
   */
  settings?: {
    /**
     * Maximum number of rows to retain per unique stream id in the offset table.
     * Older rows beyond this count will be removed.
     * Default is 10,000.
     */
    maxRows?: number
  }
}

export class ClickhouseState extends AbstractState implements State {
  options: Options & Required<Pick<Options, 'database' | 'id'>>
  initial?: Offset

  private readonly fullTableName: string

  constructor(
    private client: ClickHouseClient,
    { onRollback, ...rest }: Options,
  ) {
    super()

    this.options = {
      database: 'default',
      id: 'stream',
      ...rest,
      settings: {
        maxRows: 10_000,
        ...rest.settings,
      },
    }

    if (this.options.settings?.maxRows && this.options.settings?.maxRows <= 0) {
      throw new Error(`Max rows must be greater than 0`)
    }

    this.fullTableName = `"${this.options.database}"."${this.options.table}"`

    this.onRollback = async (event) => {
      switch (event.type) {
        case 'blockchain_fork':
          if (!onRollback) throw new Error('Fork handler is not defined')

          const block = await this.findLatestUnforkedBlock(event.canonicalBlocks)
          if (!block) throw new Error('Block not found')

          await onRollback({ state: this, latest: block })

          return block

        case 'offset_check':
          await onRollback?.({ state: this, latest: event.expectedLatestOffset })

          return event.expectedLatestOffset

        default:
          throw new Error(`Unknown rollback event type: ${(event as any).type}`)
      }
    }
  }

  async commitOffset({ latest, finalized, chain_continuity }: UnfinalizedOffset) {
    const timestamp = Date.now()

    chain_continuity = chain_continuity || []

    await this.client.insert({
      table: this.options.table,
      values: [
        {
          id: this.options.id,
          latest: this.encodeOffset(latest),
          initial: this.initial ? this.encodeOffset(this.initial) : undefined,
          chain_continuity: JSON.stringify(chain_continuity),
          sign: 1,
          timestamp,
        },
      ],
      format: 'JSONEachRow',
    })

    const count = await this._removeAllRows({
      table: this.options.table,
      query: `
            SELECT *
            FROM ${this.options.table} FINAL
            ORDER BY "timestamp" DESC
            OFFSET ${this.options.settings?.maxRows}
        `,
    })

    this.options.logger?.debug(`Removed unused offsets from ${count} rows from ${this.options.table}`)
  }

  async getOffset(defaultValue: Offset) {
    try {
      const res = await this.client.query({
        query: `SELECT *
                FROM "${this.options.database}"."${this.options.table}"
                WHERE id = {id:String}
                ORDER BY timestamp DESC
                LIMIT 1`,
        format: 'JSONEachRow',
        query_params: { id: this.options.id },
      })

      const [row] = await res.json<{ latest: string; initial: string }>()
      if (row) {
        this.initial = this.decodeOffset(row.initial)

        return {
          latest: this.decodeOffset(row.latest),
          initial: this.initial,
        }
      } else {
        this.initial = defaultValue
        await this.commitOffset({ latest: defaultValue, chain_continuity: [] })

        return
      }
    } catch (e: unknown) {
      if (e instanceof Error && 'type' in e && e.type === 'UNKNOWN_TABLE') {
        await this.client.command({
          query: table(this.fullTableName),
        })

        this.initial = defaultValue
        await this.commitOffset({ latest: defaultValue, chain_continuity: [] })

        return
      }

      throw e
    }
  }

  async findLatestUnforkedBlock(unforked: BlockCursor[]): Promise<BlockCursor | null> {
    const res = await this.client.query({
      query: `SELECT * FROM ${this.fullTableName} ORDER BY "timestamp" DESC`,
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

  async removeAllRows({
    table,
    params,
    where,
  }: {
    table: string | string[]
    where: string
    params?: Record<string, unknown>
  }) {
    const tables = typeof table === 'string' ? [table] : table

    await Promise.all(
      tables.map(async (table) => {
        // TODO check engine

        const count = await this._removeAllRows({
          table,
          query: `SELECT * FROM ${table} FINAL WHERE ${where}`,
          params,
        })

        this.options.logger?.info(`Rolled back ${count} rows from ${table}`)
      }),
    )
  }

  private async _removeAllRows({
    table,
    query,
    params,
  }: {
    table: string
    query: string
    params?: Record<string, unknown>
  }) {
    let count = 0
    const res = await this.client.query({
      query,
      format: 'JSONEachRow',
      clickhouse_settings: {
        date_time_output_format: 'iso',
      },
      query_params: params,
    })

    for await (const rows of res.stream()) {
      await this.client.insert({
        table,
        values: rows.map((row: any) => {
          const data = row.json()

          data.sign = -1

          return data
        }),
        format: 'JSONEachRow',
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
        },
      })

      count += rows.length
    }

    return count
  }
}
