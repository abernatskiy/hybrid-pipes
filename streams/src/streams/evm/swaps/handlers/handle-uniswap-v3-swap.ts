import { events as UniswapV3SwapsEvents } from '../../contracts/uniswap.v3/swaps'
import type { DecodedEvmSwap } from '../evm-swap-stream'

export const handleUniswapV3Swap = (log: any): DecodedEvmSwap | null => {
  const data = UniswapV3SwapsEvents.Swap.decode(log)

  return {
    dexName: 'uniswap',
    protocol: 'uniswap_v3',
    from: {
      amount: data.amount0,
      sender: data.sender,
    },
    to: {
      amount: data.amount1,
      recipient: data.recipient,
    },
  }
}
