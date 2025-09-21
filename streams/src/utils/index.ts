export * from './solana'

/**
 * Format a number with US locale formatting and up to 2 decimal places
 *
 * @param value - The number to format
 * @returns The formatted number string with US locale formatting
 * @example
 * formatNumber(1000) // "1,000"
 * formatNumber(1000000) // "1,000,000"
 * formatNumber(1234.5678) // "1,234.57"
 * formatNumber(1234.5) // "1,234.50"
 */

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}

/**
 * Parse a block number from a string. Remove commas and underscores
 *
 * @param block - The block number to parse
 * @returns The parsed block number
 * @example
 * ```ts
 * parseBlockNumber("1_000_000") // 1000000
 * parseBlockNumber("1,000,000") // 1000000
 * ```
 */
export function parseBlockNumber(block: number | string) {
  if (typeof block === 'string') {
    const value = Number(block.replace(/[_,]/g, ''))
    if (Number.isNaN(value)) {
      throw new Error(
        `Can't parse a block number from string "${block}". Valid examples: "1000000", "1_000_000", "1,000,000"`,
      )
    }

    return value
  }

  return block
}

/**
 * Check if a value is not null or undefined
 *
 * @param value - The value to check
 * @returns True if the value is not null or undefined, false otherwise
 * @example
 * ```ts
 * nonNullable(1) // true
 * nonNullable(null) // false
 * nonNullable(undefined) // false
 * ```
 */
export function nonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined
}

/**
 * Add context to an error
 *
 * @param err - The error to add context to
 * @param ctx - The context to add to the error
 * @returns The error with the added context
 */
export function addErrorContext<T extends Error>(err: T, ctx: any): T {
  const e = err as any
  for (const key in ctx) {
    if (e[key] == null) {
      e[key] = ctx[key]
    }
  }
  return err
}
