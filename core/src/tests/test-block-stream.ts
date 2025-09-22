import { createTransformer } from '../core'

export function blockTransformer<H, T extends { header: H }>() {
  return createTransformer<{ blocks: T[] }, H[]>({
    transform: (data) => {
      return data.blocks.flatMap((b) => b.header)
    },
  })
}
