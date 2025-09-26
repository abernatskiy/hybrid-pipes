import {
  createEvmPortalSource,
  type EvmPortalData,
  createTarget,
  createTransformer
} from '@abernatskiy/hybrid-pipes-core'

import { queryBuilderWithUsdcTransfers } from './01-trivial-pipe'

async function main() {
  const source = createEvmPortalSource({
    portal: 'https://portal.sqd.dev/datasets/ethereum-mainnet',
    query: queryBuilderWithUsdcTransfers,
  })

  const target = createTarget({
    write: async ({ctx: {logger, profiler}, read}) => {
      for await (const {data} of read()) {
        logger.info({data}, 'data')
      }
    },
  })

  const transformer = createTransformer({
    transform: async (data: EvmPortalData<any>) => {
      return data.blocks.map(b => b.logs.map(l => l.transactionHash))
    }
  })

  const anotherTransformer = createTransformer({
    transform: async (data: EvmPortalData<any>) => {
      return data.blocks.map(b => b.logs.length)
    }
  })

  await source
    .extend({
      hashes: transformer,
      lenghts: anotherTransformer,
    })
    .pipeTo(target)
}

main().then(() => { console.log('done') })