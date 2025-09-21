import { events as PoolEvents } from './contracts/aave.v3/mainnet-pool'
import { events as PoolConfiguratorEvents } from './contracts/aave.v3/pool-configurator'
import { events as AaveTokenEvents } from './contracts/aave.v3/tokenization'
import { Events, EvmDecodedEventStream } from './decoded-event-stream'

type ParamsWithoutArgs<T extends Events> = Omit<
  ConstructorParameters<typeof EvmDecodedEventStream<T>>[0],
  'args'
>

export const AaveV3PoolEventStream = (params: ParamsWithoutArgs<typeof PoolEvents>) =>
  new EvmDecodedEventStream({
    ...params,
    args: {
      contracts: [
        '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // Ethereum mainnet
      ],
      events: {
        ReserveDataUpdated: PoolEvents.ReserveDataUpdated,
      },
    },
  })

export const AaveV3PoolConfiguratorStream = (
  params: ParamsWithoutArgs<typeof PoolConfiguratorEvents>,
) =>
  new EvmDecodedEventStream({
    ...params,
    args: {
      contracts: [
        '0x64b761d848206f447fe2dd461b0c635ec39ebb27', // Ethereum mainnet
      ],
      events: {
        ReserveInitialized: PoolConfiguratorEvents.ReserveInitialized,
      },
    },
  })

export const AaveV3ATokenEventStream = (params: ParamsWithoutArgs<typeof AaveTokenEvents>) =>
  new EvmDecodedEventStream({
    ...params,
    args: {
      events: {
        Mint: AaveTokenEvents.Mint,
        Burn: AaveTokenEvents.Burn,
        Initialized: AaveTokenEvents.Initialized,
        BalanceTransfer: AaveTokenEvents.BalanceTransfer,
      },
    },
  })
