import { createEvmPortalSource, EvmQueryBuilder, rpcLatencyWatcher } from '@abernatskiy/hybrid-pipes-core'

async function main() {
  const query = new EvmQueryBuilder()
    .addFields({ block: { number: true, hash: true, timestamp: true } })
    .addLog({
      range: { from: 35440331 }, // base
      // range: { from: 23345783 }, // eth
      // range: { from: 378280117 }, // arb
      request: {},
    })

  const stream = createEvmPortalSource({
    portal: 'https://portal.sqd.dev/datasets/base-mainnet',
    // portal: 'https://portal.sqd.dev/datasets/ethereum-mainnet',
    // portal: 'https://portal.sqd.dev/datasets/arbitrum-one',
    query,
  }).pipe(
    rpcLatencyWatcher({
      rpcUrl: [
        'wss://base-mainnet.blastapi.io/856bac86-7784-4062-9a7d-08b4317b5078',
        // 'wss://eth-mainnet.blastapi.io/856bac86-7784-4062-9a7d-08b4317b5078',
        // 'wss://arbitrum-one.blastapi.io/856bac86-7784-4062-9a7d-08b4317b5078',
      ],
    }),
  )

  for await (const { data, ctx } of stream) {
    console.dir(data, { depth: null })
    console.log('---PERFORMANCE---')
    console.log(ctx.profiler.toString())
  }
}

void main()
