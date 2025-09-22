## Architecture

Observations about the PortalAbstractStream class:
 - it's a class!
 - its successors must implement `stream(): Promise<ReadableStream<Res[]>>`
 - it provides a method `getStream()` to the methods of its ancestors
 - it extends NodeJS's [`EventEmitter`](https://nodejs.org/api/events.html#class-eventemitter)
 - it uses a `pino` logger by default; overridable by passing a `logger` field to the options object (the constructor argument)
 - it uses the `portal` options object field as a portal URL if it's a string, or as a source of portal client options if it's an object
 - the args field of the options object has the `Args` type
 - it requires a fixed block range
 - it takes an optional `state` field
 - it takes optional `onProgress` and `onStart` hooks; these print some progress messages if unspecified
 - it has a `warnOnlyOnce` method that ensures that the message is printed only once and clogs memory

Observations about the state type:
 - it must be able to `.setLogger`
 - 