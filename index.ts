"use strict";
const { resolveCaller } = require("./identity/resolver");
const authz = require("./authz/engine");
const limiter = require("./rate-limit/limiter");
const audit = require("./audit/logger");
const queue = require("./queue/in-memory");

interface TranscribeRequest {
  source?: string;
  provider?: string;
  sourceData?: unknown;
  maxBytes?: number;
  language?: string;
  skipQueue?: boolean;
}

interface Caller {
  service?: string;
  scope?: string;
  userId?: string;
}

interface TranscribeResult {
  outcome: string;
  denyReason: string | null;
  latencyMs: number;
  errorMessage?: string;
  text?: string;
  model?: string;
  durationSec?: number;
  bytes?: number;
  costUsd?: number;
}

interface OutcomeRecord {
  ts: string;
  source: string | undefined;
  provider: string;
  callerService: string;
  callerScope: string;
  callerUserId: string;
  outcome: string;
  denyReason: string | null;
  latencyMs: number;
  errorMessage?: string;
  bytes?: number;
  durationSec?: number;
  costUsd?: number;
}

interface FetchedData {
  buffer: Buffer;
  mimeType?: string;
  filename?: string;
  durationSec?: number;
}

interface Adapter {
  transcribe(buffer: Buffer, options: { mimeType?: string; filename?: string; language?: string; durationSec?: number }): Promise<{ text: string; model?: string; costUsd?: number }>;
}

interface Source {
  fetch(data: unknown, options: { maxBytes?: number }): Promise<FetchedData>;
}

interface QueueEnqueueResult {
  result: Promise<{ text: string; model?: string; costUsd?: number; durationSec?: number; bytes: number }>;
}

interface Queue {
  enqueue<T>(work: () => Promise<T>): Promise<QueueEnqueueResult>;
  stats(): unknown;
}

interface AuthzResult {
  allow: boolean;
  reason?: string;
}

interface RateLimitResult {
  ok: boolean;
  reason?: string;
}

const _adapters: Map<string, Adapter> = new Map();
const _sources: Map<string, Source> = new Map();

function _getAdapter(provider: string): Adapter | null {
  if (_adapters.has(provider)) return _adapters.get(provider) as Adapter;
  let adapter: Adapter;
  switch (provider) {
    case "whisper":
      adapter = require("./adapters/whisper").create() as Adapter;
      break;
    default:
      return null;
  }
  _adapters.set(provider, adapter);
  return adapter;
}

function _getSource(source: string): Source | null {
  if (_sources.has(source)) return _sources.get(source) as Source;
  let s: Source;
  switch (source) {
    case "telegram":
      s = require("./sources/telegram").create() as Source;
      break;
    default:
      return null;
  }
  _sources.set(source, s);
  return s;
}

function _nowIso(): string {
  return new Date().toISOString();
}

/**
 * Dispatch a transcription request through all gateway layers.
 * Never throws — returns { outcome, denyReason, text?, ... }.
 *
 * @param request
 * @param caller
 * @returns
 */
async function transcribe(request: TranscribeRequest, caller: Caller): Promise<TranscribeResult> {
  const started: number = Date.now();
  const provider: string = (request && request.provider) || "whisper";

  const rec: OutcomeRecord = {
    ts: _nowIso(),
    source: request && request.source,
    provider,
    callerService: (caller && caller.service) || "",
    callerScope: (caller && caller.scope) || "",
    callerUserId: (caller && caller.userId) || "",
    outcome: "denied",
    denyReason: null,
    latencyMs: 0,
  };

  try {
    // L2 — Identity (default-deny)
    const resolved: unknown = await resolveCaller(caller);
    if (!resolved) {
      rec.denyReason = "L2_unknown_caller";
      return _finalize(rec, started);
    }

    // L3 — Authz (default-deny)
    const authzResult: AuthzResult = await authz.check(resolved, request);
    if (!authzResult.allow) {
      rec.denyReason = authzResult.reason || "L3_authz";
      return _finalize(rec, started);
    }

    // L4 — Rate limit + cost cap
    const rateOk: RateLimitResult = await limiter.check((resolved as { service?: string }).service);
    if (!rateOk.ok) {
      rec.denyReason = rateOk.reason || "L4_rate_limit";
      return _finalize(rec, started);
    }

    // L1 — resolve source + adapter
    const src: Source | null = _getSource(request.source);
    if (!src) {
      rec.denyReason = "L1_source";
      return _finalize(rec, started);
    }
    const adapter: Adapter | null = _getAdapter(provider);
    if (!adapter) {
      rec.denyReason = "L1_adapter";
      return _finalize(rec, started);
    }

    // The actual work: fetch buffer → transcribe.
    const work = async (): Promise<{ text: string; model?: string; costUsd?: number; durationSec?: number; bytes: number }> => {
      const fetched: FetchedData = await src.fetch(request.sourceData, { maxBytes: request.maxBytes });
      if (!fetched?.buffer || fetched.buffer.length === 0) {
        const e: Error & { code?: string } = new Error("source returned empty buffer");
        e.code = "EMPTY";
        throw e;
      }
      const out: { text: string; model?: string; costUsd?: number } = await adapter.transcribe(fetched.buffer, {
        mimeType: fetched.mimeType,
        filename: fetched.filename,
        language: request.language,
        durationSec: fetched.durationSec,
      });
      return { ...out, durationSec: fetched.durationSec, bytes: fetched.buffer.length };
    };

    // Q — queue (or sync if caller asks)
    let result: { text: string; model?: string; costUsd?: number; durationSec?: number; bytes: number };
    if (request.skipQueue) {
      result = await work();
    } else {
      let enq: QueueEnqueueResult;
      try {
        enq = await queue.enqueue(work);
      } catch (qErr: unknown) {
        if ((qErr as Error & { code?: string }).code === "QUEUE_FULL") {
          rec.denyReason = "L4_rate_limit";
          return _finalize(rec, started);
        }
        throw qErr;
      }
      result = await enq.result;
    }

    if (result.costUsd) limiter.recordCost((resolved as { service?: string }).service, result.costUsd);

    rec.outcome = "ok";
    rec.bytes = result.bytes;
    rec.durationSec = result.durationSec;
    rec.costUsd = result.costUsd;
    const finalized: TranscribeResult = await _finalize(rec, started);
    return {
      ...finalized,
      text: result.text,
      model: result.model,
      durationSec: result.durationSec,
      bytes: result.bytes,
      costUsd: result.costUsd,
    };
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    const errMsg: string = (err && (err as Error).message) || String(err);
    console.error("[voice-gateway] transcribe fatal:", errMsg);
    rec.outcome = "error";
    rec.errorMessage = errMsg.slice(0, 300);
    if (err && (err as Error & { code?: string }).code === "TOO_LARGE") rec.denyReason = "L1_too_large";
    else if (err && (err as Error & { code?: string }).code === "EMPTY") rec.denyReason = "L1_empty";
    else if (/getFile|telegram|download|fetch failed/i.test(errMsg)) rec.denyReason = rec.denyReason || "L1_source";
    else if (/whisper|HTTP \d|api\.openai\.com|max_completion_tokens|max_tokens/i.test(errMsg)) rec.denyReason = rec.denyReason || "L1_adapter";
    else rec.denyReason = rec.denyReason || "L1_unknown";
    return _finalize(rec, started);
  }
}

async function _finalize(rec: OutcomeRecord, started: number): Promise<TranscribeResult> {
  rec.latencyMs = Date.now() - started;
  try {
    await audit.record(rec);
  } catch (_e: unknown) {
    // swallowed
  }
  return {
    outcome: rec.outcome,
    denyReason: rec.denyReason,
    latencyMs: rec.latencyMs,
    errorMessage: rec.errorMessage,
  };
}

function queueStats(): unknown {
  return queue.stats();
}

export = { transcribe, queueStats };