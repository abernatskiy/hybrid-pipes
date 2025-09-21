import { events as AerodromeFactoryEvents } from '../../contracts/aerodrome/factory'
import { events as AerodromeSwapEvents } from '../../contracts/aerodrome/swaps'
import { events as UniswapV2FactoryEvents } from '../../contracts/uniswap.v2/factory'
import { events as UniswapV2SwapEvents } from '../../contracts/uniswap.v2/swaps'
import { events as UniswapV3FactoryEvents } from '../../contracts/uniswap.v3/factory'
import { events as UniswapV3SwapEvents } from '../../contracts/uniswap.v3/swaps'
import type { Network } from '../../types'
import type { DexProtocol } from '../evm-swap-stream'
import {
  AERODROME_DEPLOYMENTS,
  UNISWAP_V2_DEPLOYMENTS,
  UNISWAP_V3_DEPLOYMENTS,
} from './deployments'

export const NetworksMappings: Record<
  Network,
  Partial<Record<DexProtocol, { pools: any; swaps: any }>>
> = {
  'ethereum-mainnet': {
    uniswap_v3: {
      pools: {
        address: [UNISWAP_V3_DEPLOYMENTS['ethereum-mainnet'].UniswapV3Factory],
        topic0: [UniswapV3FactoryEvents.PoolCreated.topic],
        transaction: true,
      },
      swaps: [
        {
          topic0: [UniswapV3SwapEvents.Swap.topic],
          transaction: true,
        },
      ],
    },
  },
  'base-mainnet': {
    uniswap_v3: {
      pools: {
        address: [UNISWAP_V3_DEPLOYMENTS['base-mainnet'].UniswapV3Factory],
        topic0: [UniswapV3FactoryEvents.PoolCreated.topic],
        transaction: true,
      },
      swaps: {
        topic0: [UniswapV3SwapEvents.Swap.topic],
        transaction: true,
      },
    },
    uniswap_v2: {
      pools: {
        address: [UNISWAP_V2_DEPLOYMENTS['base-mainnet'].UniswapV2Factory],
        topic0: [UniswapV2FactoryEvents.PairCreated.topic],
        transaction: true,
      },
      swaps: {
        topic0: [UniswapV2SwapEvents.Swap.topic],
        transaction: true,
      },
    },
    aerodrome_basic: {
      pools: {
        address: [AERODROME_DEPLOYMENTS['base-mainnet'].BasicPoolFactory],
        topic0: [AerodromeFactoryEvents.BasicPoolCreated.topic],
        transaction: true,
      },
      swaps: {
        topic0: [AerodromeSwapEvents.BasicPoolSwap.topic],
        transaction: true,
      },
    },
    aerodrome_slipstream: {
      pools: {
        address: [AERODROME_DEPLOYMENTS['base-mainnet'].SlipstreamPoolFactory],
        topic0: [AerodromeFactoryEvents.CLFactoryPoolCreated.topic],
        transaction: true,
      },
      swaps: {
        topic0: [AerodromeSwapEvents.SlipstreamPoolSwap.topic],
        transaction: true,
      },
    },
  },
}
