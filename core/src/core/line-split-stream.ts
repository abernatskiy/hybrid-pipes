import { ReadableWritablePair } from 'node:stream/web'

export class LineSplitStream implements ReadableWritablePair<string[], string> {
  private line = ''
  private transform: TransformStream<string, string[]>

  get readable() {
    return this.transform.readable
  }
  get writable() {
    return this.transform.writable
  }

  constructor(separator: string) {
    this.transform = new TransformStream({
      transform: (chunk, controller) => {
        const lines = chunk.split(separator)
        if (lines.length === 1) {
          this.line += lines[0]
        } else {
          const result: string[] = []
          lines[0] = this.line + lines[0]
          this.line = lines.pop() || ''
          result.push(...lines)
          controller.enqueue(result)
        }
      },
      flush: (controller) => {
        if (this.line) {
          controller.enqueue([this.line])
          this.line = ''
        }
        // NOTE: not needed according to the spec, but done the same way in nodejs sources
        controller.terminate()
      },
    })
  }
}
