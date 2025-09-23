import {
  createEvmDecoder,
  createEvmPortalSource,
  parsePortalRange,
  sqliteFactory,
  sqlitePortalCache,
} from '@abernatskiy/hybrid-pipes-core'
import { erc20Transfers, uniswapV3, uniswapV3Decoder } from '../src'
import { events } from '../src/streams/evm/contracts/erc20'

async function cli() {
  const stream = createEvmPortalSource({
    portal: 'https://portal.sqd.dev/datasets/base-mainnet',
  }).pipe(
    createEvmDecoder({
      profiler: { id: 'erc20_transfers' },
      range: { from: 'latest' },
      events: {
        transfers: events.Transfer,
      },
    }),
  )

  for await (const { data } of stream) {
    const blocks = new Set(data.transfers.map((t) => t.blockNumber)).size
    console.log(`${data.transfers.length} transfers in ${blocks} blocks`)
  }
}

void cli()
