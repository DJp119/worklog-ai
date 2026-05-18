import { AsyncLocalStorage } from 'node:async_hooks'

export interface LogContext {
    requestId?: string
    userId?: string
    jobRunId?: string
    [key: string]: any
}

// The MDC equivalent
export const mdc = new AsyncLocalStorage<LogContext>()

/**
 * Get the current MDC context.
 */
export function getMdcContext(): LogContext {
    return mdc.getStore() || {}
}
