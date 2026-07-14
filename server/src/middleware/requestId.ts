import { randomUUID } from 'crypto'
import { Request, Response, NextFunction } from 'express'
import { mdc, LogContext } from '../lib/mdc.js'

// Whitelist for client-supplied X-Request-Id values.
// Why: line 6 below feeds the value into the structured logger MDC context and
// echoes it in the response header. Without a whitelist, a client can inject
// newlines, ANSI escapes, or HTML into log lines (CWE-117). UUIDs, ULIDs, and
// short alphanumeric trace IDs all fit in [A-Za-z0-9_-]{8,64}.
const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
    const headerId = req.headers['x-request-id']
    const requestId =
        typeof headerId === 'string' && VALID_REQUEST_ID.test(headerId)
            ? headerId
            : randomUUID()
    res.setHeader('X-Request-Id', requestId)

    // Initialize MDC context for this request
    const context: LogContext = { requestId }

    // Run the rest of the request inside this MDC context
    mdc.run(context, () => {
        next()
    })
}
