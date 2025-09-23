import fs from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PortalBatch } from '../core/portal-source'
import { createEvmPortalSource } from '../evm'
import { blockTransformer, closeMockPortal, createMockPortal, MockPortal } from '../tests'
import { sqlitePortalCache } from './adapters/sqlite'

export async function readAllChunk(stream: AsyncIterable<PortalBatch>) {
  const res: unknown[] = []

  for await (const {
    data,
    ctx: {
      head,
      query,
      bytes,
      state,
      // do not include it in the test
      metrics,
      logger,
      profiler,
    },
  } of stream) {
    res.push({ data, meta: { head, query, bytes, state } })
  }

  return res
}

const DB_PATH = './test.db'

describe('Portal cache', () => {
  let mockPortal: MockPortal

  afterEach(async () => {
    await closeMockPortal(mockPortal)
  })

  beforeEach(async () => {
    await fs.rm(DB_PATH)
  })

  describe('Sqlite adapter', () => {
    it('should store requests and get the same result on second pass', async () => {
      mockPortal = await createMockPortal([
        {
          statusCode: 200,
          data: [
            { header: { number: 1, hash: '0x1', timestamp: 1000 } },
            { header: { number: 2, hash: '0x2', timestamp: 2000 } },
            { header: { number: 3, hash: '0x3', timestamp: 3000 } },
            { header: { number: 4, hash: '0x4', timestamp: 4000 } },
            { header: { number: 5, hash: '0x5', timestamp: 5000 } },
          ],
          finalizedHead: { number: 2, hash: '0x2' },
        },
      ])

      const stream = createEvmPortalSource({
        portal: mockPortal.url,
        query: { from: 0, to: 5 },
        cache: {
          adapter: await sqlitePortalCache({ path: DB_PATH }),
        },
      }).pipe(blockTransformer())

      const res1 = await readAllChunk(stream)
      const res2 = await readAllChunk(stream)

      expect(res1).toEqual(res2)
      expect(res2).toMatchInlineSnapshot(`
        [
          {
            "data": [
              {
                "hash": "0x1",
                "number": 1,
                "timestamp": 1000,
              },
              {
                "hash": "0x2",
                "number": 2,
                "timestamp": 2000,
              },
              {
                "hash": "0x3",
                "number": 3,
                "timestamp": 3000,
              },
              {
                "hash": "0x4",
                "number": 4,
                "timestamp": 4000,
              },
              {
                "hash": "0x5",
                "number": 5,
                "timestamp": 5000,
              },
            ],
            "meta": {
              "bytes": 265,
              "head": {
                "finalized": {
                  "hash": "0x2",
                  "number": 2,
                },
                "unfinalized": undefined,
              },
              "query": {
                "hash": "75676946b5b3239b522c78056fab6de6",
                "raw": {
                  "fields": {},
                  "fromBlock": 0,
                  "parentBlockHash": undefined,
                  "toBlock": 5,
                  "type": "evm",
                },
              },
              "state": {
                "current": {
                  "hash": "0x5",
                  "number": 5,
                  "timestamp": 5000,
                },
                "initial": 0,
                "last": 5,
                "rollbackChain": [
                  {
                    "hash": "0x2",
                    "number": 2,
                    "timestamp": 2000,
                  },
                  {
                    "hash": "0x3",
                    "number": 3,
                    "timestamp": 3000,
                  },
                  {
                    "hash": "0x4",
                    "number": 4,
                    "timestamp": 4000,
                  },
                  {
                    "hash": "0x5",
                    "number": 5,
                    "timestamp": 5000,
                  },
                ],
              },
            },
          },
        ]
      `)
    })
  })
})
