import { events as AerodromeSwapEvents } from '../../contracts/aerodrome/swaps'
import type { DecodedEvmSwap } from '../evm-swap-stream'

export const handleAerodromeSlipstreamSwap = (log: any): DecodedEvmSwap | null => {
  const data = AerodromeSwapEvents.SlipstreamPoolSwap.decode(log)

  return {
    dexName: 'aerodrome',
    protocol: 'aerodrome_slipstream',
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
