interface EnqueueResult {
    taskId: string;
    position: number;
    result: Promise<unknown>;
}
/**
 * Enqueue work. Returns a promise that resolves with the work's result.
 * Rejects with code:"QUEUE_FULL" if backpressure threshold exceeded.
 *
 * @param fn   thunk that performs the actual work
 * @returns
 */
declare function enqueue(fn: () => Promise<unknown>): Promise<EnqueueResult>;
interface Stats {
    active: number;
    pending: number;
    maxConcurrent: number;
    maxQueued: number;
}
declare function stats(): Stats;
declare const _default: {
    enqueue: typeof enqueue;
    stats: typeof stats;
    MAX_CONCURRENT: number;
    MAX_QUEUED: number;
};
export = _default;
//# sourceMappingURL=in-memory.d.ts.map