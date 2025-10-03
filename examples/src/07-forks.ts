import { createTarget } from '@sqd-pipes/pipes'
import { createEvmPortalSource, createEvmDecoder } from '@sqd-pipes/pipes/evm'

import { commonAbis } from '@sqd-pipes/pipes/evm'

import { createSolanaPortalSource, SolanaQueryBuilder } from '@sqd-pipes/pipes/solana'

async function main() {
  const source = createEvmPortalSource({ portal: 'https://portal.sqd.dev/datasets/ethereum-mainnet' })

  const transformer = createEvmDecoder({
    contracts: ['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'], // USDC
    events: {
      transfer: commonAbis.erc20.events.Transfer
    },
    range: { from: 23485209 }
  })

  await source
    .pipe(transformer)
    .pipeTo(createTarget({
      write: async ({ctx: {logger, profiler}, read}) => {
        for await (const {data} of read()) {
          logger.info(`Got ${data.transfer.length} transfers`)
        }
      },
      fork: async (previousBlocks) => {
        console.log(`Got a fork with ${previousBlocks.length} previous blocks`)
        return null
      }
    }))
}

async function main2() {
  const source = createSolanaPortalSource({
    portal: 'https://portal.sqd.dev/datasets/solana-mainnet',
    query: new SolanaQueryBuilder()
      .addFields({
        block: {
          number: true,
          parentHash: true,
          hash: true,
          timestamp: true
        }
      })
      .addInstruction({
        request: {
          programId: ['whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc']
        },
        range: {
          from: 370682346
        }
      })
  })

  await source.pipeTo(createTarget({
      write: async ({ctx: {logger, profiler}, read}) => {
        for await (const {data} of read()) {
          logger.info(`Got ${data.blocks.length} blocks`)
        }
      },
      fork: async (previousBlocks) => {
        console.log(`Got a fork with ${previousBlocks.length} previous blocks`)
        return null
      }
    })
  )


}

main2().then(() => { console.log('\n\ndone') })