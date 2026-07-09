import cron from 'node-cron'
import { logger } from './logger.js'

export function isSchedulerNode(): boolean {
    const v = process.env.IS_SCHEDULER_NODE
    if (v === 'true' || v === '1') return true
    if (v === 'false' || v === '0') return false
    return true
}

export interface ScheduledJob {
    start: () => void
    stop: () => void
    runNow?: () => Promise<void>
}

/**
 * Helper to create a cron job with standard boilerplate and IS_SCHEDULER_NODE checks.
 */
export function startJob(name: string, cronSchedule: string, fn: () => Promise<void>): ScheduledJob {
    let task: cron.ScheduledTask | null = null

    return {
        start() {
            if (!isSchedulerNode()) {
                logger.info(`Skipping job ${name} (IS_SCHEDULER_NODE is false)`)
                return
            }

            task = cron.schedule(cronSchedule, async () => {
                logger.info(`Starting job: ${name}`)
                try {
                    await fn()
                } catch (err: any) {
                    logger.error(`Job failed (${name}): {}`, err.message)
                }
            })

            logger.info(`Job scheduled: ${name} (${cronSchedule})`)
        },
        stop() {
            if (task) {
                task.stop()
                task = null
                logger.info(`Job stopped: ${name}`)
            }
        },
        runNow: fn,
    }
}
