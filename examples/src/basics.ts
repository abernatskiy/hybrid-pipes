import {
  createEvmPortalSource,
  createTarget,
  EvmQueryBuilder
} from '@sqd-pipes/core'

async function main() {

  const queryBuilder = new EvmQueryBuilder()
  queryBuilder.addFields({
    block: {
      // These two fields are required.
      // For now please manually add them to the query builder.
      // Once is enough, anywhere is fine.
      number: true, hash: true,
    },
    log: {
      address: true,
      topics: true,
      data: true,
      transactionHash: true,
    }
  })
  queryBuilder.addLog({
    request: {
      address: ['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'], // USDC
      topic0: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'], // Transfer
    },
    range: {
      from: 20000000,
      to: 20000000,
    }
  })

  const source = createEvmPortalSource({
    portal: 'https://portal.sqd.dev/datasets/ethereum-mainnet',
    query: queryBuilder,
  })

  const target = createTarget({
    write: async ({ctx: {logger, profiler}, read}) => {
      for await (const {data} of read()) {
        logger.info({data}, 'data')
      }
    },
  })

  await source.pipeTo(target)
}

main().then(() => { console.log('done') })