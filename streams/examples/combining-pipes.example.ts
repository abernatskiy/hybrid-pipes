import { createEvmPortalSource, sqliteFactory, sqlitePortalCache } from '@abernatskiy/hybrid-pipes-core'
import { erc20Transfers, uniswapV3, uniswapV3Decoder } from '../src'

async function cli() {
  const range = { from: '20,000,000', to: '+1,000' }

  const stream = createEvmPortalSource({
    portal: 'https://portal.sqd.dev/datasets/base-mainnet',
    // cache: {
    //   adapter: await sqlitePortalCache({ path: './cache.sqlite' }),
    // },
  }).extend({
    transfers: erc20Transfers({ range }),
    uniswapV3: uniswapV3Decoder({
      range,
      factory: {
        address: uniswapV3['base-mainnet'].factory,
        database: await sqliteFactory({ path: './uniswap-v3-pools.sqlite' }),
      },
    }),
  })

  for await (const { data, ctx } of stream) {
    console.log('-------------------------------------')
    console.log(`parsed ${data.transfers.length} transfers`)
    console.log(`parsed ${data.uniswapV3.length} swaps`)
    console.log('-------------------------------------')
    // console.log(ctx.profiler.toString())
  }
}

void cli()
