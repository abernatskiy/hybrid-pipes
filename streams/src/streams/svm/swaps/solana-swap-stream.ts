import { type BlockRef, type OptionalArgs, PortalAbstractStream } from '@abernatskiy/hybrid-pipes-core'
import { getInstructionDescriptor } from '@subsquid/solana-stream'
import { getTransaction, getTransactionAccount, getTransactionHash } from '../../../utils'
import * as meteoraDamm from '../contracts/meteora-damm'
import * as meteoraDlmm from '../contracts/meteora-dlmm'
import * as whirlpool from '../contracts/orca-whirlpool'
import * as raydiumClmm from '../contracts/raydium-clmm'
import * as raydiumAmm from '../contracts/raydium-cpmm'
import { handleMeteoraDamm, handleMeteoraDlmm } from './handlers/meteora-swap-handler'
import { handleWhirlpool } from './handlers/orca-swap-handler'
import { handleRaydiumAmm } from './handlers/raydium-amm-swap-handler'
import { handleRaydiumClmm } from './handlers/raydium-clmm-swap-handler'

export type SwapType =
  | 'orca_whirlpool'
  | 'meteora_damm'
  | 'meteora_dlmm'
  | 'raydium_clmm'
  | 'raydium_amm'

export interface TokenAmount {
  amount: bigint
  mint: string
  decimals: number
}

// TODO: the properties tokenA, tokenB, slippage and reserves are nullable
// because they were not implemented yet for Meteora. Once implemented the
// values should be required
export type SolanaSwap = {
  id: string
  type: SwapType
  account: string
  transaction: { hash: string; index: number }
  input: TokenAmount
  output: TokenAmount
  instruction: { address: number[] }
  block: BlockRef
  timestamp: Date
  poolAddress: string | null
  tokenA: string | null
  tokenB: string | null
  slippage: number | null
  reserves: {
    tokenA: TokenAmount
    tokenB: TokenAmount
  } | null
}

export type SolanaSwapTransfer = {
  type: SwapType
  account: string
  in: { amount: bigint; token: { postMint: string; postDecimals: number } }
  out: { amount: bigint; token: { postMint: string; postDecimals: number } }
  poolAddress: string | null
  tokenA: string | null
  tokenB: string | null
  slippage: number | null
  reserves: {
    tokenA: TokenAmount
    tokenB: TokenAmount
  } | null
}

export class SolanaSwapsStream extends PortalAbstractStream<
  SolanaSwap,
  OptionalArgs<{
    tokens?: string[]
    type?: SwapType[]
  }>
> {
  async stream(): Promise<ReadableStream<SolanaSwap[]>> {
    const { args } = this.options

    const types = args?.type || [
      'orca_whirlpool',
      'meteora_damm',
      'meteora_dlmm',
      'raydium_clmm',
      'raydium_amm',
    ]

    const source = await this.getStream({
      type: 'solana',
      fields: {
        block: {
          number: true,
          hash: true,
          timestamp: true,
        },
        transaction: {
          transactionIndex: true,
          signatures: true,
          accountKeys: true,
          loadedAddresses: true,
        },
        instruction: {
          transactionIndex: true,
          data: true,
          instructionAddress: true,
          programId: true,
          accounts: true,
        },
        tokenBalance: {
          transactionIndex: true,
          account: true,
          preMint: true,
          postMint: true,
          preAmount: true,
          postAmount: true,
          preDecimals: true,
          postDecimals: true,
        },
        log: {
          transactionIndex: true,
          instructionAddress: true,
          message: true,
          logIndex: true,
        },
      },
      instructions: types.map((type) => {
        switch (type) {
          case 'orca_whirlpool':
            return {
              programId: [whirlpool.programId], // where executed by Whirlpool program
              d8: [whirlpool.instructions.swap.d8],
              isCommitted: true,
              innerInstructions: true,
              transaction: true,
              transactionTokenBalances: true,
              logs: true,
            }
          case 'meteora_damm':
            return {
              programId: [meteoraDamm.programId],
              d8: [meteoraDamm.instructions.swap.d8],
              isCommitted: true,
              innerInstructions: true,
              transaction: true,
              transactionTokenBalances: true,
              logs: true,
            }
          case 'meteora_dlmm':
            return {
              programId: [meteoraDlmm.programId],
              d8: [meteoraDlmm.instructions.swap.d8, meteoraDlmm.instructions.swapExactOut.d8],
              isCommitted: true,
              innerInstructions: true,
              transaction: true,
              transactionTokenBalances: true,
              logs: true,
            }
          case 'raydium_clmm':
            return {
              programId: [raydiumClmm.programId],
              d8: [
                raydiumClmm.instructions.swap.d8,
                raydiumClmm.instructions.swapV2.d8,
                raydiumClmm.instructions.swapRouterBaseIn.d8,
              ],
              isCommitted: true,
              innerInstructions: true,
              transaction: true,
              transactionTokenBalances: true,
              logs: true,
            }
          case 'raydium_amm':
            return {
              programId: [raydiumAmm.programId],
              d1: [
                raydiumAmm.instructions.swapBaseInput.d8,
                raydiumAmm.instructions.swapBaseOutput.d8,
              ],
              isCommitted: true,
              innerInstructions: true,
              transaction: true,
              transactionTokenBalances: true,
              logs: true,
            }
        }
      }),
    })

    return source.pipeThrough(
      new TransformStream({
        transform: ({ blocks }, controller) => {
          // FIXME
          const res = blocks.flatMap((block) => {
            if (!block.instructions) return []

            const swaps: SolanaSwap[] = []

            for (const ins of block.instructions) {
              let swap: SolanaSwapTransfer | null = null

              const tx = getTransaction(ins, block)
              const accountKeys = tx.accountKeys || []

              // FIXME: Defi Tuna instructions have multiple swaps and for some reason
              // we're not being able to decode innner instructions properly.
              if (accountKeys.includes('tuna4uSQZncNeeiAMKbstuxA9CUkHH6HmC64wgmnogD')) continue

              switch (ins.programId) {
                case whirlpool.programId:
                  if (whirlpool.instructions.swap.d8 === getInstructionDescriptor(ins)) {
                    swap = handleWhirlpool(ins, block)
                    break
                  }
                  break
                case meteoraDamm.programId:
                  switch (getInstructionDescriptor(ins)) {
                    case meteoraDamm.instructions.swap.d8:
                      swap = handleMeteoraDamm(this.logger, ins, block)
                      break
                  }
                  break
                case meteoraDlmm.programId:
                  switch (getInstructionDescriptor(ins)) {
                    case meteoraDlmm.instructions.swap.d8:
                    case meteoraDlmm.instructions.swapExactOut.d8:
                      swap = handleMeteoraDlmm(ins, block)
                      break
                  }
                  break
                case raydiumAmm.programId:
                  switch (getInstructionDescriptor(ins)) {
                    case raydiumAmm.instructions.swapBaseInput.d8:
                    case raydiumAmm.instructions.swapBaseOutput.d8:
                      swap = handleRaydiumAmm(ins, block)
                      break
                  }
                  break
                case raydiumClmm.programId:
                  switch (getInstructionDescriptor(ins)) {
                    case raydiumClmm.instructions.swap.d8:
                    case raydiumClmm.instructions.swapV2.d8:
                      // TODO: should uncomment this line once swapRouterBaseIn instruction handler is implemented
                      // case raydiumClmm.instructions.swapRouterBaseIn.d8:
                      swap = handleRaydiumClmm(ins, block)
                      break
                  }
                  break
              }

              if (!swap) continue

              if (
                args?.tokens &&
                !this.isPairAllowed(swap.in.token.postMint, swap.out.token.postMint)
              ) {
                continue
              }

              const txHash = getTransactionHash(ins, block)

              swaps.push({
                id: `${txHash}/${ins.transactionIndex}`,
                type: swap.type,
                block: {
                  number: block.header.number,
                  hash: block.header.hash,
                  timestamp: block.header.timestamp,
                },
                instruction: {
                  address: ins.instructionAddress,
                },
                input: {
                  amount: swap.in.amount,
                  mint: swap.in.token.postMint,
                  decimals: swap.in.token.postDecimals,
                },
                output: {
                  amount: swap.out.amount,
                  mint: swap.out.token.postMint,
                  decimals: swap.out.token.postDecimals,
                },
                account: getTransactionAccount(ins, block),
                transaction: {
                  hash: txHash,
                  index: ins.transactionIndex,
                },
                timestamp: new Date(block.header.timestamp * 1000),
                poolAddress: swap.poolAddress,
                tokenA: swap.tokenA,
                tokenB: swap.tokenB,
                slippage: swap.slippage,
                reserves: swap.reserves,
              })
            }

            return swaps
          })

          if (!res.length) {
            // If we have an empty array of data, we must acknowledge the batch anyway to mark it as processed
            this.ack()
            return
          }

          controller.enqueue(res)
        },
      }),
    )
  }

  private isPairAllowed(tokenA: string, tokenB: string) {
    const { tokens } = this.options.args || {}

    if (!tokens) return true

    const isTokenAAllowed = tokens.includes(tokenA)
    const isTokenBAllowed = tokens.includes(tokenB)

    return isTokenAAllowed && isTokenBAllowed
  }
}
