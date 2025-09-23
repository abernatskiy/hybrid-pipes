import {
  createEvmDecoder,
  createFactory,
  FactoryPersistentAdapter,
  PortalRange,
  parsePortalRange,
} from '@abernatskiy/hybrid-pipes-core'

import { events as factoryAbi } from '../../contracts/uniswap.v2/factory'
import { events as swapsAbi } from '../../contracts/uniswap.v2/swaps'
import { DecodedEvmSwap } from '../types'

function uniswapV2Decoder({
  range,
  factory,
}: {
  range: PortalRange
  factory: {
    address: string
    database: FactoryPersistentAdapter<any>
  }
}) {
  return createEvmDecoder({
    profiler: { id: 'uniswap_v2_decode' },
    range: parsePortalRange(range),
    contracts: createFactory({
      address: factory.address,
      event: factoryAbi.PairCreated,
      parameter: (e) => e.pair,
      database: factory.database,
    }),
    events: {
      swaps: swapsAbi.Swap,
    },
  }).pipe({
    profiler: { id: 'rename_fields' },
    transform: (data) => {
      return data.swaps.map(
        (s): DecodedEvmSwap => ({
          address: s.event.sender,
          transactionHash: s.transactionHash,
          from: {
            amount: s.event.amount0Out > 0n ? -s.event.amount0Out : s.event.amount0In,
            token: s.factory.event.token0,
          },
          to: {
            amount: s.event.amount1Out > 0n ? -s.event.amount1Out : s.event.amount1In,
            token: s.factory.event.token1,
          },
        }),
      )
    },
  })
}

export const uniswapV2 = {
  networks: {
    'base-mainnet': {
      factory: '0x8909dc15e40173ff4699343b6eb8132c65e18ec6'.toLowerCase(),
      range: '6_601_915',
    },
  },
  decoder: uniswapV2Decoder,
} as const
