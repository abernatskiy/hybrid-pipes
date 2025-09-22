import {
  createEvmDecoder,
  createFactory,
  FactoryPersistentAdapter,
  PortalRange,
  parsePortalRange,
} from '@abernatskiy/hybrid-pipes-core'
import { events as factoryAbi } from '../../contracts/uniswap.v3/factory'
import { events as swapsAbi } from '../../contracts/uniswap.v3/swaps'
import { DecodedEvmSwap } from '../types'

export function uniswapV3Decoder({
  range,
  factory,
}: {
  range?: PortalRange
  factory: {
    address: string
    database: FactoryPersistentAdapter<any>
  }
}) {
  return createEvmDecoder({
    profiler: { id: 'uniswap_v3_decode' },
    range: parsePortalRange(range),
    contracts: createFactory({
      address: factory.address,
      event: factoryAbi.PoolCreated,
      parameter: (e) => e.pool,
      database: factory.database,
    }),
    events: {
      swaps: swapsAbi.Swap,
    },
  }).pipe({
    profiler: { id: 'rename_fields' },
    transform: (data) => {
      return data.swaps.map((s): DecodedEvmSwap => {
        return {
          address: s.event.sender,
          transactionHash: s.transactionHash,
          from: {
            amount: s.event.amount0,
            token: s.factory.event.token0,
          },
          to: {
            amount: s.event.amount1,
            token: s.factory.event.token1,
          },
        }
      })
    },
  })
}

export const uniswapV3 = {
  'ethereum-mainnet': {
    factory: '0x1f98431c8ad98523631ae4a59f267346ea31f984'.toLowerCase(),
    range: { from: '12,369,621' },
  },
  'base-mainnet': {
    factory: '0x33128a8fc17869897dce68ed026d694621f6fdfd'.toLowerCase(),
    range: { from: '1,371,680' },
  },
} as const
