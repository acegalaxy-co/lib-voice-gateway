"use strict";

const { createSlidingWindow } = require("../../security-utils-nodejs/rate-limit");

const QPS_WINDOW_MS: number = 60_000;
const DAY_MS: number = 24 * 60 * 60 * 1000;
const DEFAULT_QPS: number = Number(process.env.VOICE_GW_QPS_PER_MIN || 30);
const DEFAULT_DAILY_COST_USD: number = Number(process.env.VOICE_GW_DAILY_COST_USD || 5);

interface CostEntry {
  dayStart: number;
  usd: number;
}

// Per-service daily cost tracker. Resets after DAY_MS rolls over.
const _costToday: Map<string, CostEntry> = new Map(); // service → { dayStart, usd }

interface ExtraCheckResult {
  ok: boolean;
  reason?: string;
}

/**
 * Cost-cap extra-check plugged into sliding-window. Runs AFTER QPS check.
 * Reads from _costToday (no increment — that happens in recordCost() after STT).
 *
 * @param key  always equals `service` for this limiter
 */
function _costCapCheck(key: string): ExtraCheckResult {
  const cost = _costToday.get(key);
  if (cost && Date.now() - cost.dayStart < DAY_MS && cost.usd >= DEFAULT_DAILY_COST_USD) {
    return { ok: false, reason: "L4_cost_cap" };
  }
  return { ok: true };
}

interface LimiterInstance {
  check: (key: string) => Promise<{ ok: boolean; reason?: string }>;
}

const limiter: LimiterInstance = createSlidingWindow({
  windowMs: QPS_WINDOW_MS,
  maxRequests: DEFAULT_QPS,
  keyFn: (service: string): string => service || "",
  reasonOnDeny: "L4_rate_limit",
  extraChecks: [_costCapCheck],
});

/**
 * @param service
 * @returns Promise resolving to check result
 */
async function check(service: string): Promise<{ ok: boolean; reason?: string }> {
  return limiter.check(service);
}

/**
 * Record actual cost incurred (called after successful STT).
 * @param service
 * @param usd
 */
function recordCost(service: string, usd: number): void {
  if (!service || !usd) return;
  const now: number = Date.now();
  const cur: CostEntry | undefined = _costToday.get(service);
  if (!cur || now - cur.dayStart >= DAY_MS) {
    _costToday.set(service, { dayStart: now, usd });
  } else {
    cur.usd += usd;
    _costToday.set(service, cur);
  }
}

export = { check, recordCost };