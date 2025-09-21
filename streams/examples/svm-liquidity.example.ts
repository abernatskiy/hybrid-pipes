import { createClient } from '@clickhouse/client'
import { ClickhouseState } from '../src/core/state/clickhouse-state'
import { SolanaLiquidityStream } from '../src/streams'

async function solanaLiquidity() {
  const clickhouseClient = createClient({
    url: 'http://localhost:8123',
    username: 'default',
    password: 'password',
  })
  const ds = new SolanaLiquidityStream({
    portal: 'https://portal.sqd.dev/datasets/solana-beta',
    blockRange: {
      from: 317617481,
    },
    args: {
      type: ['meteora'],
    },
    logger: console as any,
    state: new ClickhouseState(clickhouseClient, {
      table: 'solana_sync_status',
      id: 'solana_liquidity',
    }),
  })

  const stream = await ds.stream()
  for await (const liquidity of stream) {
    console.log(liquidity)
    await ds.ack()
  }
}

solanaLiquidity()
