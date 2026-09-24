"use strict";
const { resolveCaller } = require("./identity/resolver");
const authz = require("./authz/engine");
const limiter = require("./rate-limit/limiter");
const audit = require("./audit/logger");
const queue = require("./queue/in-memory");
const _adapters = new Map();
const _sources = new Map();
function _getAdapter(provider) {
    if (_adapters.has(provider))
        return _adapters.get(provider);
    let adapter;
    switch (provider) {
        case "whisper":
            adapter = require("./adapters/whisper").create();
            break;
        default:
            return null;
    }
    _adapters.set(provider, adapter);
    return adapter;
}
function _getSource(source) {
    if (_sources.has(source))
        return _sources.get(source);
    let s;
    switch (source) {
        case "telegram":
            s = require("./sources/telegram").create();
            break;
        default:
            return null;
    }
    _sources.set(source, s);
    return s;
}
function _nowIso() {
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
async function transcribe(request, caller) {
    const started = Date.now();
    const provider = (request && request.provider) || "whisper";
    const rec = {
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
        const resolved = await resolveCaller(caller);
        if (!resolved) {
            rec.denyReason = "L2_unknown_caller";
            return _finalize(rec, started);
        }
        // L3 — Authz (default-deny)
        const authzResult = await authz.check(resolved, request);
        if (!authzResult.allow) {
            rec.denyReason = authzResult.reason || "L3_authz";
            return _finalize(rec, started);
        }
        // L4 — Rate limit + cost cap
        const rateOk = await limiter.check(resolved.service);
        if (!rateOk.ok) {
            rec.denyReason = rateOk.reason || "L4_rate_limit";
            return _finalize(rec, started);
        }
        // L1 — resolve source + adapter
        const src = _getSource(request.source);
        if (!src) {
            rec.denyReason = "L1_source";
            return _finalize(rec, started);
        }
        const adapter = _getAdapter(provider);
        if (!adapter) {
            rec.denyReason = "L1_adapter";
            return _finalize(rec, started);
        }
        // The actual work: fetch buffer → transcribe.
        const work = async () => {
            const fetched = await src.fetch(request.sourceData, { maxBytes: request.maxBytes });
            if (!fetched?.buffer || fetched.buffer.length === 0) {
                const e = new Error("source returned empty buffer");
                e.code = "EMPTY";
                throw e;
            }
            const out = await adapter.transcribe(fetched.buffer, {
                mimeType: fetched.mimeType,
                filename: fetched.filename,
                language: request.language,
                durationSec: fetched.durationSec,
            });
            return { ...out, durationSec: fetched.durationSec, bytes: fetched.buffer.length };
        };
        // Q — queue (or sync if caller asks)
        let result;
        if (request.skipQueue) {
            result = await work();
        }
        else {
            let enq;
            try {
                enq = await queue.enqueue(work);
            }
            catch (qErr) {
                if (qErr.code === "QUEUE_FULL") {
                    rec.denyReason = "L4_rate_limit";
                    return _finalize(rec, started);
                }
                throw qErr;
            }
            result = await enq.result;
        }
        if (result.costUsd)
            limiter.recordCost(resolved.service, result.costUsd);
        rec.outcome = "ok";
        rec.bytes = result.bytes;
        rec.durationSec = result.durationSec;
        rec.costUsd = result.costUsd;
        const finalized = await _finalize(rec, started);
        return {
            ...finalized,
            text: result.text,
            model: result.model,
            durationSec: result.durationSec,
            bytes: result.bytes,
            costUsd: result.costUsd,
        };
    }
    catch (err) {
        // eslint-disable-next-line no-console
        const errMsg = (err && err.message) || String(err);
        console.error("[voice-gateway] transcribe fatal:", errMsg);
        rec.outcome = "error";
        rec.errorMessage = errMsg.slice(0, 300);
        if (err && err.code === "TOO_LARGE")
            rec.denyReason = "L1_too_large";
        else if (err && err.code === "EMPTY")
            rec.denyReason = "L1_empty";
        else if (/getFile|telegram|download|fetch failed/i.test(errMsg))
            rec.denyReason = rec.denyReason || "L1_source";
        else if (/whisper|HTTP \d|api\.openai\.com|max_completion_tokens|max_tokens/i.test(errMsg))
            rec.denyReason = rec.denyReason || "L1_adapter";
        else
            rec.denyReason = rec.denyReason || "L1_unknown";
        return _finalize(rec, started);
    }
}
async function _finalize(rec, started) {
    rec.latencyMs = Date.now() - started;
    try {
        await audit.record(rec);
    }
    catch (_e) {
        // swallowed
    }
    return {
        outcome: rec.outcome,
        denyReason: rec.denyReason,
        latencyMs: rec.latencyMs,
        errorMessage: rec.errorMessage,
    };
}
function queueStats() {
    return queue.stats();
}
module.exports = { transcribe, queueStats };
//# sourceMappingURL=index.js.map