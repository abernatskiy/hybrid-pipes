import {
  createEvmPortalSource,
  createTarget,
  type EvmPortalData,
  createTransformer
} from '@abernatskiy/hybrid-pipes-core'

import { queryBuilderWithUsdcTransfers } from './01-trivial-pipe'

async function main() {
  const source = createEvmPortalSource({
    portal: 'https://portal.sqd.dev/datasets/ethereum-mainnet',
    query: queryBuilderWithUsdcTransfers,
  })

  const transformer = createTransformer({
    transform: async (data: EvmPortalData<any>) => {
      return data.blocks.map(b => b.logs.map(l => l.transactionHash))
    }
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