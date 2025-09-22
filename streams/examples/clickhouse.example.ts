import { createClient } from '@clickhouse/client'
import { createClickhouseTarget, createEvmPortalSource } from '@abernatskiy/hybrid-pipes-core'
import { erc20Transfers } from '../src'

async function cli() {
  const client = createClient({
    username: 'default',
    password: 'default',
    url: 'http://localhost:10123',
  })

  await createEvmPortalSource({
    portal: 'https://portal.sqd.dev/datasets/base-mainnet',
  })
    .pipe(erc20Transfers())
    .pipeTo(
      createClickhouseTarget({
        client,
        onStart: async () => {},
        onData: async ({ data, ctx }) => {
          const span = ctx.profiler.start('my measure')
          console.log('batch')
          console.log(`parsed ${data.length} transfers`)
          console.log('----------------------------------')
          span.end()
        },
      }),
    )
}

void cli()
