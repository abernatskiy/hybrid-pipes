import { afterEach, describe, expect, it } from 'vitest'

import { closeMockPortal, createMockPortal, MockPortal, readAll, TestStream } from '../tests'

describe('Portal abstract stream', () => {
  let mockPortal: MockPortal

  afterEach(() => closeMockPortal(mockPortal))

  it('should receive all stream data and stop', async () => {
    mockPortal = await createMockPortal([
      {
        statusCode: 200,
        data: [
          { header: { number: 1, hash: '0x123', timestamp: 1000 } },
          { header: { number: 2, hash: '0x456', timestamp: 2000 } },
        ],
      },
    ])

    const testStream = new TestStream({
      portal: mockPortal.url,
      blockRange: { from: 0, to: 2 },
    })

    const res = await readAll(await testStream.stream())

    expect(res).toMatchInlineSnapshot(`
      [
        [
          {
            "hash": "0x123",
            "number": 1,
            "timestamp": 1000,
          },
          {
            "hash": "0x456",
            "number": 2,
            "timestamp": 2000,
          },
        ],
      ]
    `)
  })

  it('should retries 10 by default', async () => {
    mockPortal = await createMockPortal([
      {
        statusCode: 200,
        data: [{ header: { number: 1, hash: '0x123', timestamp: 1000 } }],
      },
      ...new Array(10).fill({ statusCode: 503 }),
      {
        statusCode: 200,
        data: [{ header: { number: 2, hash: '0x456', timestamp: 2000 } }],
      },
    ])

    const ds = new TestStream({
      portal: {
        url: mockPortal.url,
        http: { retrySchedule: [0] },
      },
      blockRange: { from: 0, to: 2 },
    })

    const res = await readAll(await ds.stream())

    expect(res).toMatchInlineSnapshot(`
      [
        [
          {
            "hash": "0x123",
            "number": 1,
            "timestamp": 1000,
          },
        ],
        [
          {
            "hash": "0x456",
            "number": 2,
            "timestamp": 2000,
          },
        ],
      ]
    `)
  })

  it('should throw an error after max retries', async () => {
    mockPortal = await createMockPortal([
      {
        statusCode: 200,
        data: [{ header: { number: 1, hash: '0x123', timestamp: 1000 } }],
      },
      ...new Array(2).fill({ statusCode: 503 }),
    ])

    const ds = new TestStream({
      portal: {
        url: mockPortal.url,
        http: {
          retryAttempts: 1,
          retrySchedule: [0],
        },
      },
      blockRange: { from: 0, to: 2 },
    })

    const stream = await ds.stream()

    await expect(readAll(stream)).rejects.toThrow(`Got 503 from ${mockPortal.url}`)
  })

  it('should throw fork exception', async () => {
    mockPortal = await createMockPortal([
      {
        statusCode: 200,
        data: [
          {
            header: {
              number: 100_000_000,
              hash: '0x100000000',
              timestamp: 1000,
            },
          },
        ],
      },
      {
        statusCode: 409,
        data: {
          previousBlocks: [
            {
              number: 99_999_999,
              hash: '0x99999999__1',
            },
            {
              number: 100_000_000,
              hash: '0x100000000__1',
            },
          ],
        },
        validateRequest: (req) => {
          expect(req).toMatchObject({
            type: 'solana',
            fromBlock: 100_000_001,
            parentBlockHash: '0x100000000',
          })
        },
      },
    ])

    const ds = new TestStream({
      portal: {
        url: mockPortal.url,
        http: { retryAttempts: 0, retrySchedule: [0] },
      },
      blockRange: { from: 0, to: 100_000_001 },
    })

    const stream = await ds.stream()

    await expect(readAll(stream)).rejects.toThrow(
      [
        `A blockchain fork was detected at 100,000,001 block.`,
        `-----------------------------------------`,
        `The correct hash:        "0x100000000__1".`,
        `But the client provided: "0x100000000".`,
        `-----------------------------------------`,
        // TODO add a link to the docs
        `Please refer to the documentation on how to handle forks.`,
      ].join('\n'),
    )
  })
})
