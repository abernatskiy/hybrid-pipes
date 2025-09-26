import {
  createEvmPortalSource,
  createTarget,
  createEvmDecoder
} from '@abernatskiy/hybrid-pipes-core'

import * as erc20abi from './abi/erc20'

async function main() {
  const source = createEvmPortalSource({
    portal: 'https://portal.sqd.dev/datasets/ethereum-mainnet'
    // we can omit the query builder, the source with add a blank one
  })

  const transformer = createEvmDecoder({
    contracts: ['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'], // USDC
    events: [erc20abi.events.Transfer],
    range: { from: 20_000_000, to: 20_000_000 }
  })

  const target = createTarget({
    write: async ({ctx: {logger, profiler}, read}) => {
      for await (const {data} of read()) {
        logger.info({data}, 'data')
      }
    },
  })

  await source.pipe(transformer).pipeTo(target)
}
if (!module.parent) {
  main().then(() => { console.log('done') })
}