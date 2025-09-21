import { last } from '@subsquid/util-internal'

import { formatNumber, lines } from './formatters'
import { BlockRef } from './portal-client'

export class ForkException extends Error {
  readonly name = 'ForkError'

  constructor(
    readonly previousBlocks: BlockRef[],
    readonly query: { fromBlock?: number; parentBlockHash?: string },
  ) {
    const parent = last(previousBlocks)

    const block = query.fromBlock ? formatNumber(query.fromBlock) : 'last'

    super(
      lines([
        `A blockchain fork was detected at ${block} block.`,
        `-----------------------------------------`,
        `The correct hash:        "${parent.hash}".`,
        `But the client provided: "${query.parentBlockHash}".`,
        `-----------------------------------------`,
        `Please refer to the documentation on how to handle forks.`,
      ]),
    )
  }
}

export function isForkException(err: unknown): err is ForkException {
  if (err instanceof ForkException) return true
  if (err instanceof Error && err.name === 'ForkError') return true

  return false
}
