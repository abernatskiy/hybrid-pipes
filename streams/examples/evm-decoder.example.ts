import { EvmDecodedEventStream } from '../src/streams'
import { events } from '../src/streams/evm/contracts/erc20'

/**
 * Simple example showing how to use EvmSwapStream
 */
async function main() {
  const swapStream = new EvmDecodedEventStream({
    portal: 'https://portal.sqd.dev/datasets/base-mainnet',
    blockRange: {
      from: 33000642,
    },
    args: {
      contracts: ['0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'],
      events: {
        transfer: events.Transfer,
        approval: events.Approval,
      } as const,
    },
    logger: console as any,
  })

  const stream = await swapStream.stream()

  for await (const blocks of stream) {
    const approvals = blocks.flatMap((block) => block.approval)
    const transfers = blocks.flatMap((block) => block.transfer)

    console.log(approvals.length, transfers.length)
  }
}

// Run the example
main()
