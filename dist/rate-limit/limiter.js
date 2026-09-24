"use strict";
const { createSlidingWindow } = require("@acegalaxy/lib-security-utils/rate-limit");
const QPS_WINDOW_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_QPS = Number(process.env.VOICE_GW_QPS_PER_MIN || 30);
// Backward compat: accept both env names. VOICE_STT_DAILY_USD_CAP is consumer-facing
// (documented in .env templates); VOICE_GW_DAILY_COST_USD is gateway-internal legacy.
const DEFAULT_DAILY_COST_USD = Number(process.env.VOICE_STT_DAILY_USD_CAP || process.env.VOICE_GW_DAILY_COST_USD || 5);
// Per-service daily cost tracker. Resets after DAY_MS rolls over.
const _costToday = new Map(); // service → { dayStart, usd }
/**
 * Cost-cap extra-check plugged into sliding-window. Runs AFTER QPS check.
 * Reads from _costToday (no increment — that happens in recordCost() after STT).
 *
 * @param key  always equals `service` for this limiter
 */
function _costCapCheck(key) {
    const cost = _costToday.get(key);
    if (cost && Date.now() - cost.dayStart < DAY_MS && cost.usd >= DEFAULT_DAILY_COST_USD) {
        return { ok: false, reason: "L4_cost_cap" };
    }
    return { ok: true };
}
const limiter = createSlidingWindow({
    windowMs: QPS_WINDOW_MS,
    maxRequests: DEFAULT_QPS,
    keyFn: (service) => service || "",
    reasonOnDeny: "L4_rate_limit",
    extraChecks: [_costCapCheck],
});
/**
 * @param service
 * @returns Promise resolving to check result
 */
async function check(service) {
    return limiter.check(service);
}
/**
 * Record actual cost incurred (called after successful STT).
 * @param service
 * @param usd
 */
function recordCost(service, usd) {
    if (!service || !usd)
        return;
    const now = Date.now();
    const cur = _costToday.get(service);
    if (!cur || now - cur.dayStart >= DAY_MS) {
        _costToday.set(service, { dayStart: now, usd });
    }
    else {
        cur.usd += usd;
        _costToday.set(service, cur);
    }
}
module.exports = { check, recordCost };
//# sourceMappingURL=limiter.js.map