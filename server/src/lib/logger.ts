import pino from 'pino'
import { getMdcContext } from './mdc.js'

const isDev = process.env.NODE_ENV !== 'production'

const pinoLogger = pino({
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    ...(isDev && {
        transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
    }),
    redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token', 'refreshToken'],
        censor: '[REDACTED]',
    },
    serializers: {
        err: pino.stdSerializers.err,
    },
})

// Helper to replace {} placeholders SLF4J style
function formatMessage(msg: string, args: any[]): { formattedMsg: string; remainingArgs: any[] } {
    let argIndex = 0
    const formattedMsg = msg.replace(/\{\}/g, () => {
        if (argIndex < args.length) {
            const val = args[argIndex++]
            return typeof val === 'object' ? JSON.stringify(val) : String(val)
        }
        return '{}'
    })
    return { formattedMsg, remainingArgs: args.slice(argIndex) }
}

// The SLF4J-style Logger Interface
class Slf4jLogger {
    private baseContext: Record<string, any> = {}

    constructor(context: Record<string, any> = {}) {
        this.baseContext = context
    }

    // Fluent builder for extra context
    with(key: string, value: any): Slf4jLogger {
        return new Slf4jLogger({ ...this.baseContext, [key]: value })
    }

    private log(level: pino.Level, message: string, ...args: any[]) {
        const { formattedMsg, remainingArgs } = formatMessage(message, args)

        // Merge MDC context, logger base context, and any remaining trailing arguments as objects
        const mdcContext = getMdcContext()
        let logObj = { ...mdcContext, ...this.baseContext }

        if (remainingArgs.length > 0 && typeof remainingArgs[0] === 'object') {
            // If there's a trailing object (like an error), merge it
            if (remainingArgs[0] instanceof Error) {
                logObj = { ...logObj, err: remainingArgs[0] }
            } else {
                logObj = { ...logObj, ...remainingArgs[0] }
            }
        }

        pinoLogger[level](logObj, formattedMsg)
    }

    debug(msg: string, ...args: any[]) { this.log('debug', msg, ...args) }
    info(msg: string, ...args: any[]) { this.log('info', msg, ...args) }
    warn(msg: string, ...args: any[]) { this.log('warn', msg, ...args) }
    error(msg: string, ...args: any[]) { this.log('error', msg, ...args) }
    fatal(msg: string, ...args: any[]) { this.log('fatal', msg, ...args) }
}

export const logger = new Slf4jLogger()
