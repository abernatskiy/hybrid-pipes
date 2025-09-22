export const aerodromeBasic = {
  networks: {
    'base-mainnet': {
      factory: '0x420dd381b31aef6683db6b902084cb0ffece40da'.toLowerCase(),
      range: '3_200_559',
    },
  },

  BasicPoolFactory: '0x420dd381b31aef6683db6b902084cb0ffece40da'.toLowerCase(), // deployed block 3_200_559
  SlipstreamPoolFactory: '0x5e7bb104d84c7cb9b682aac2f3d509f5f406809a'.toLowerCase(), // deployed block 13_843_704
  // decoder: uniswapV2Decoder,
} as const
