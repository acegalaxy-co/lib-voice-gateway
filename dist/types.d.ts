/**
 * @typedef {Object} Caller
 * @property {string} service    service name (e.g. "nexus-bot", "fw-bot", "web-app")
 * @property {string} scope      scope identifier (e.g. "nexus", "framework")
 * @property {string|number} [userId] end-user identifier (telegram user id, phone, email)
 * @property {string[]} [roles]  optional role list for authz
 */
export interface Caller {
    service: string;
    scope: string;
    userId?: string | number;
    roles?: string[];
}
/**
 * @typedef {Object} TranscribeRequest
 * @property {"telegram"|"whatsapp"|"wechat"|"http"|"file"} source
 * @property {Object} sourceData         opaque per-source descriptor (fileId, mediaId, path, buffer...)
 * @property {string} [language]         BCP-47 hint, "auto" allowed
 * @property {string} [provider]         override: "whisper" (default), "gemini", "local"
 * @property {boolean} [skipQueue]       caller wants synchronous (small files only)
 * @property {number} [maxBytes]         override gateway default
 */
export interface TranscribeRequest {
    source: "telegram" | "whatsapp" | "wechat" | "http" | "file";
    sourceData: Record<string, unknown>;
    language?: string;
    provider?: string;
    skipQueue?: boolean;
    maxBytes?: number;
}
/**
 * @typedef {Object} TranscribeResult
 * @property {"ok"|"denied"|"queued"|"error"} outcome
 * @property {string|null} denyReason
 * @property {string} [text]             transcript on outcome=ok
 * @property {string} [model]            STT model used
 * @property {number} [durationSec]      audio length
 * @property {number} [bytes]            payload size
 * @property {number} [costUsd]          best-effort estimate
 * @property {number} [queuePosition]    on outcome=queued
 * @property {string} [taskId]           queue task id
 * @property {number} latencyMs
 */
export interface TranscribeResult {
    outcome: "ok" | "denied" | "queued" | "error";
    denyReason: string | null;
    text?: string;
    model?: string;
    durationSec?: number;
    bytes?: number;
    costUsd?: number;
    queuePosition?: number;
    taskId?: string;
    latencyMs: number;
}
/**
 * @typedef {Object} OutcomeRecord
 * @property {string} ts
 * @property {string} source
 * @property {string} provider
 * @property {string} callerService
 * @property {string} callerScope
 * @property {string|number} callerUserId
 * @property {"ok"|"denied"|"queued"|"error"} outcome
 * @property {string|null} denyReason   "L2_unknown_caller" | "L3_authz" | "L4_rate_limit" |
 *                                       "L4_cost_cap" | "L1_adapter" | "L1_source" |
 *                                       "L1_too_large" | "L1_empty"
 * @property {number} latencyMs
 * @property {number} [bytes]
 * @property {number} [durationSec]
 * @property {number} [costUsd]
 */
export interface OutcomeRecord {
    ts: string;
    source: string;
    provider: string;
    callerService: string;
    callerScope: string;
    callerUserId: string | number;
    outcome: "ok" | "denied" | "queued" | "error";
    denyReason: string | null;
    latencyMs: number;
    bytes?: number;
    durationSec?: number;
    costUsd?: number;
}
declare const _default: {};
export = _default;
//# sourceMappingURL=types.d.ts.map