"use strict";

const MAX_CONCURRENT: number = Number(process.env.VOICE_GW_MAX_CONCURRENT || 2);
const MAX_QUEUED: number = Number(process.env.VOICE_GW_MAX_QUEUED || 100);

let _seq: number = 0;

interface PendingTask {
  id: string;
  fn: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  enqueuedAt: number;
}

const _pending: PendingTask[] = [];
let _active: number = 0;

function _drain(): void {
  while (_active < MAX_CONCURRENT && _pending.length > 0) {
    const task = _pending.shift()!;
    _active++;
    Promise.resolve()
      .then(task.fn)
      .then(
        (val: unknown) => {
          _active--;
          task.resolve(val);
          _drain();
        },
        (err: unknown) => {
          _active--;
          task.reject(err);
          _drain();
        },
      );
  }
}

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
function enqueue(fn: () => Promise<unknown>): Promise<EnqueueResult> {
  if (_pending.length >= MAX_QUEUED) {
    const e = new Error(`voice queue full (${_pending.length}/${MAX_QUEUED})`);
    (e as any).code = "QUEUE_FULL";
    return Promise.reject(e);
  }
  _seq++;
  const id = `vq_${Date.now().toString(36)}_${_seq}`;
  let resolve: (value: unknown) => void;
  let reject: (reason: unknown) => void;
  const result = new Promise<unknown>((res, rej) => { resolve = res; reject = rej; });
  const position = _pending.length + _active + 1;
  _pending.push({ id, fn, resolve: resolve!, reject: reject!, enqueuedAt: Date.now() });
  _drain();
  return Promise.resolve({ taskId: id, position, result });
}

interface Stats {
  active: number;
  pending: number;
  maxConcurrent: number;
  maxQueued: number;
}

function stats(): Stats {
  return {
    active: _active,
    pending: _pending.length,
    maxConcurrent: MAX_CONCURRENT,
    maxQueued: MAX_QUEUED,
  };
}

export = { enqueue, stats, MAX_CONCURRENT, MAX_QUEUED };