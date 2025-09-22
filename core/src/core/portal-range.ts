export function parseBlockFormatting(block: string | number) {
  if (typeof block === 'number') return block
  /**
   * Remove commas and underscores
   * 1_000_000 -> 1000000
   * 1,000,000 -> 1000000
   */
  const value = Number(block.replace(/[_,]/g, ''))
  if (Number.isNaN(value)) {
    throw new Error(
      `Can't parse a block number from string "${block}". Valid examples: "1000000", "1_000_000", "1,000,000"`,
    )
  }

  return value
}

function parseBlock(block: string | number, offset?: number) {
  if (typeof block === 'number') return block

  if (block.startsWith('+') && offset) {
    return offset + parseBlockFormatting(block.substring(1))
  }

  return parseBlockFormatting(block)
}

export function parsePortalRange(range?: PortalRange, defaultValue?: PortalRange): ParsedRange {
  //
  range = range || defaultValue || { from: 0 }

  const from = parseBlock(range.from || '0')
  const to = range.to ? parseBlock(range.to, from) : undefined

  return { from, to }
}

export type PortalRange = { from?: number | string; to?: number | string }
export type ParsedRange = { from: number; to?: number }
