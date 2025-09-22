import pino, { Logger as PinoLogger } from 'pino'

export type Logger = PinoLogger

// FIXME 1) print level 2) time in ISO
export function createDefaultLogger() {
  return pino({
    base: null,
    messageKey: 'message',
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
      level(label) {
        return { level: label }
      },
    },
    serializers: {
      error: pino.stdSerializers.errWithCause,
      err: pino.stdSerializers.errWithCause,
    },
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        messageKey: 'message',
      },
    },
  })
}
