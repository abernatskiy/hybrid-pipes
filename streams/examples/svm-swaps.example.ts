import { createClient } from '@clickhouse/client'
import { ClickhouseState } from '../src/core/state/clickhouse-state'
import { SolanaSwapsStream } from '../src/streams'

async function solanaSwaps() {
  const clickhouseClient = createClient({
    url: 'http://localhost:8123',
    username: 'default',
    password: 'password',
  })

  const stream = new SolanaSwapsStream({
    portal: 'https://portal.sqd.dev/datasets/solana-beta',
    blockRange: {
      from: 317617480,
    },
    args: {
      type: ['orca_whirlpool', 'raydium_clmm'],
    },
    logger: console as any,
    state: new ClickhouseState(clickhouseClient, {
      table: 'solana_sync_status',
      id: 'solana_swaps',
    }),
  })

  for await (const swaps of await stream.stream()) {
    console.log(swaps)
    await stream.ack()
  }
}

solanaSwaps()
