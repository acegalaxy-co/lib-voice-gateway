# @kanelr/voice-gateway

> **NPM commons library** — Multi-source speech-to-text gateway with default-deny authz, rate limit, cost cap, queue, and audit log. Mirrors db-gateway pattern.
> Cross-cutting rules: see framework `../../rules/00-index.md`.
> ⭐⭐⭐ **Harness Architecture (P0)**: Mọi feature mới BẮT BUỘC route qua 1 trong 5 surfaces (slash command / hook / subagent / MCP / permission). Đọc `../../rules/meta/02-harness-architecture.md`. KHÔNG add ad-hoc scripts.

## Module purpose

Unified STT gateway (Whisper et al.) with 5-layer default-deny + cost guard + async queue. Project-agnostic; consumers inject identity + audit sink + provider keys.

## Key files

- `index.js` — entry point
- `adapters/`, `sources/` — STT providers + input sources
- `authz/`, `audit/`, `rate-limit/`, `identity/`, `queue/` — guards + async queue
- `types.js` — shared types
- `smoke.test.js` — smoke tests

## Embedded vs imported

Per gateway-mandatory rule: per-project independence — KHÔNG `require()` module này từ project khác. Copy code OK, scope isolation.

## Tests

`npm test` (runs `node smoke.test.js`).
