export type DecodedEvmSwap = {
  address: string
  transactionHash: string
  from: {
    amount: bigint
    token: string
  }
  to: {
    amount: bigint
    token: string
  }
}
