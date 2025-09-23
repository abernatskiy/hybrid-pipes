import { createEvmDecoder, createEvmPortalSource, createFactory, sqliteFactory } from '@abernatskiy/hybrid-pipes-core'
import { events as factoryAbi } from '../src/streams/evm/contracts/uniswap.v3/factory'
import { events as swapsAbi } from '../src/streams/evm/contracts/uniswap.v3/swaps'

async function cli() {
  const stream = createEvmPortalSource({
    portal: 'https://portal.sqd.dev/datasets/ethereum-mainnet',
    progress: {
      interval: 500,
    },
  }).pipe(
    createEvmDecoder({
      range: { from: '12,369,621', to: '12,410,000' },
      contracts: createFactory({
        address: '0x1f98431c8ad98523631ae4a59f267346ea31f984',
        event: factoryAbi.PoolCreated,
        preindex: { from: '12,369,621', to: '12,400,000' },
        parameter: 'pool',
        database: await sqliteFactory({ path: './uniswap3-eth-pools.sqlite' }),
      }),
      events: {
        swaps: swapsAbi.Swap,
      },
    }),
  )
  //
  for await (const { data, ctx } of stream) {
    // console.log('-------------------------------------')
    console.log(`parsed ${data.swaps.length} swaps`)
    // console.log('-------------------------------------')
  }
}

void cli()
