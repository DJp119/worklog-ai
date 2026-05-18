import { randomUUID } from 'crypto'
import { Request, Response, NextFunction } from 'express'
import { mdc, LogContext } from '../lib/mdc.js'

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID()
    res.setHeader('X-Request-Id', requestId)

    // Initialize MDC context for this request
    const context: LogContext = { requestId }

    // Run the rest of the request inside this MDC context
    mdc.run(context, () => {
        next()
    })
}
