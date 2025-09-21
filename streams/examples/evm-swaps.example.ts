import { EvmSwapStream } from '../src/streams/evm/swaps/evm-swap-stream'

/**
 * Simple example showing how to use EvmSwapStream
 */
async function main() {
  const swapStream = new EvmSwapStream({
    portal: 'https://portal.sqd.dev/datasets/base-mainnet',
    blockRange: {
      from: 18000000,
      to: 18010000,
    },
    args: {
      network: 'base-mainnet',
      dbPath: './db',
      protocols: ['uniswap_v3', 'uniswap_v2'],
      onlyPools: false,
    },
    logger: console as any,
  })

  // Initialize the stream
  swapStream.initialize()

  // Get and process the stream of swaps
  const stream = await swapStream.stream()

  // Process swaps in batches
  for await (const swaps of stream) {
    console.log(swaps)
  }
}

// Run the example
main()
