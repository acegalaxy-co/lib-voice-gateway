"use strict";
const MAX_CONCURRENT = Number(process.env.VOICE_GW_MAX_CONCURRENT || 2);
const MAX_QUEUED = Number(process.env.VOICE_GW_MAX_QUEUED || 100);
let _seq = 0;
const _pending = [];
let _active = 0;
function _drain() {
    while (_active < MAX_CONCURRENT && _pending.length > 0) {
        const task = _pending.shift();
        _active++;
        Promise.resolve()
            .then(task.fn)
            .then((val) => {
            _active--;
            task.resolve(val);
            _drain();
        }, (err) => {
            _active--;
            task.reject(err);
            _drain();
        });
    }
}
/**
 * Enqueue work. Returns a promise that resolves with the work's result.
 * Rejects with code:"QUEUE_FULL" if backpressure threshold exceeded.
 *
 * @param fn   thunk that performs the actual work
 * @returns
 */
function enqueue(fn) {
    if (_pending.length >= MAX_QUEUED) {
        const e = new Error(`voice queue full (${_pending.length}/${MAX_QUEUED})`);
        e.code = "QUEUE_FULL";
        return Promise.reject(e);
    }
    _seq++;
    const id = `vq_${Date.now().toString(36)}_${_seq}`;
    let resolve;
    let reject;
    const result = new Promise((res, rej) => { resolve = res; reject = rej; });
    const position = _pending.length + _active + 1;
    _pending.push({ id, fn, resolve: resolve, reject: reject, enqueuedAt: Date.now() });
    _drain();
    return Promise.resolve({ taskId: id, position, result });
}
function stats() {
    return {
        active: _active,
        pending: _pending.length,
        maxConcurrent: MAX_CONCURRENT,
        maxQueued: MAX_QUEUED,
    };
}
module.exports = { enqueue, stats, MAX_CONCURRENT, MAX_QUEUED };
//# sourceMappingURL=in-memory.js.map