import { BlockRef, PortalAbstractStream, StreamOptions } from '../core'
import { createTestLogger } from './test-logger'

export type TestRes = BlockRef

export class TestStream extends PortalAbstractStream<TestRes> {
  constructor(protected readonly options: StreamOptions) {
    super(options)

    this.logger = createTestLogger()
  }

  async stream(): Promise<ReadableStream<TestRes[]>> {
    const stream = await this.getStream({
      type: 'solana',
      fields: {
        block: {
          number: true,
          hash: true,
          timestamp: true,
        },
      },
    })

    return stream.pipeThrough(
      new TransformStream({
        transform: (data, controller) => {
          controller.enqueue(
            data.blocks.map((b) => {
              return b.header
            }),
          )
        },
      }),
    )
  }
}
