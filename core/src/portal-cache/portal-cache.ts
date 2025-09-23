import { createHash } from 'node:crypto'
import { promisify } from 'node:util'
// @ts-ignore FIXME WTF?
import { brotliCompress, brotliDecompress } from 'node:zlib'
import { BlockCursor, Logger } from '../core'
import { cursorFromHeader } from '../core/portal-source'
import { last } from '../internal/array'
import { GetBlock, PortalClient, PortalStream, PortalStreamData, Query } from '../portal-client'

const compressAsync = promisify(brotliCompress)
const decompressAsync = promisify(brotliDecompress)

function md5Hash(value: unknown) {
  return createHash('md5').update(JSON.stringify(value)).digest('hex')
}

export type SaveBatch = { queryHash: string; cursors: { first: BlockCursor; last: BlockCursor }; data: Buffer }

export interface PortalCacheAdapter {
  init?(): Promise<void>
  stream(request: { queryHash: string; cursor: BlockCursor }): AsyncIterable<Buffer>
  save(batch: SaveBatch): Promise<void>
}

/**
 * Configuration options for the Portal Cache system
 */
export interface PortalCacheOptions {
  /**
   * Enable or disable data compression.
   * Uses zstd compression algorithm.
   * @default true
   */
  compress?: boolean
  /**
   * Storage adapter implementation for caching portal data
   */
  adapter: PortalCacheAdapter
}

interface Options extends PortalCacheOptions {
  portal: PortalClient
  query: Query
  logger: Logger
}

class PortalCache {
  private readonly options: Options

  constructor(options: Options) {
    this.options = {
      compress: true,
      ...options,
    }
  }

  async compress(value: string): Promise<Buffer> {
    if (!this.options.compress) return Buffer.from(value)

    return await compressAsync(value)
  }

  async decompress(value: Buffer): Promise<string> {
    if (!this.options.compress) return value.toString('utf-8')

    const buffer = await decompressAsync(value)
    return buffer.toString('utf8')
  }

  async *getStream<Q extends Query>(): PortalStream<GetBlock<Q>> {
    const { query, portal, logger, adapter } = this.options
    const queryHash = md5Hash(query)

    let cursor: BlockCursor = { number: query.fromBlock, hash: query.parentBlockHash }

    logger.debug(`loading data from cache from ${cursor.number} block`)
    for await (const message of adapter.stream({ cursor, queryHash })) {
      const decoded: PortalStreamData<GetBlock<Q>> = JSON.parse(await this.decompress(message))
      yield decoded

      cursor = cursorFromHeader(last(decoded.blocks))
    }

    if (cursor.number === query.toBlock) return

    logger.debug(`switching to the portal from ${cursor.number} block`)
    for await (const batch of portal.getStream({
      ...query,
      fromBlock: cursor.number + 1,
      parentBlockHash: cursor.hash,
    } as Q)) {
      if (batch.blocks.length === 0) continue

      cursor = cursorFromHeader(last(batch.blocks))

      await adapter.save({
        queryHash,
        cursors: {
          first: cursorFromHeader(batch.blocks[0]),
          last: cursor,
        },
        data: await this.compress(JSON.stringify(batch)),
      })

      yield batch

      // TODO check next batch in cache
    }
  }
}

export async function createPortalCache(opts: Options) {
  const cache = new PortalCache(opts)

  await opts.adapter.init?.()

  return cache.getStream()
}
