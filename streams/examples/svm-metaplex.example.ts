import { createClient } from '@clickhouse/client'
import { ClickhouseState } from '../src/core/state/clickhouse-state'
import { SolanaMetaplexStream } from '../src/streams'

async function pumpfun() {
  const clickhouseClient = createClient({
    url: 'http://localhost:8123',
    username: 'default',
  })

  const stream = new SolanaMetaplexStream({
    portal: 'https://portal.sqd.dev/datasets/solana-beta',
    blockRange: {
      from: 317617480,
    },
    logger: console as any,
    state: new ClickhouseState(clickhouseClient, {
      table: 'solana_sync_status',
      id: 'solana_metaplex',
    }),
  })

  for await (const createdTokens of await stream.stream()) {
    console.log(createdTokens)
    await stream.ack()
  }
}

pumpfun()
