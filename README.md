# voice-gateway/ — Framework reference

Reference skeleton + spec cho Voice Gateway. Multi-source (Telegram/WhatsApp/WeChat/HTTP/file) speech-to-text gateway with default-deny authz, rate limit, cost cap, queue, and audit log.

Mirrors the [db-gateway](../db-gateway-nodejs/) pattern.

## Status

**Phase 1 skeleton** (2026-04-27) — chưa production-ready. Pilot = nexus-one nodejs.

## What it is

Thin module đứng trước mọi STT call. Funnel mọi voice transcription qua các layer default-deny trước khi chạm STT API (OpenAI Whisper, Gemini STT, local Whisper).

## Layers → folder map

| Layer | Purpose                                    | Folder / file                                 |
| ----- | ------------------------------------------ | --------------------------------------------- |
| L1    | Source (platform-specific download)        | `sources/<source>.js` (telegram, …)           |
| L1'   | Adapter (STT provider)                     | `adapters/<provider>.js` (whisper, …)         |
| L2    | Identity (caller service + scope)          | `identity/resolver.js`                        |
| L3    | Authz (caller × source × provider)         | `authz/engine.js` + `policies/*.yaml` (P2)    |
| L4    | Rate limit (QPS) + cost cap ($/day)        | `rate-limit/limiter.js`                       |
| L5    | Audit log (append-only)                    | `audit/logger.js` → `audit/audit.log` (gitignored) |
| Q     | Queue (bounded concurrency)                | `queue/in-memory.js`                          |

Entry: `require('./voice-gateway').transcribe(request, caller)` → `{ outcome, denyReason, text?, latencyMs }`. Never throws.

## Per-project independence

Framework KHÔNG ship shared lib. Mỗi project tự copy skeleton này vào `<project>/voice-gateway/` và customize policy YAML riêng. Duplicate code OK — đổi lấy scope isolation.

## API

```js
const voiceGw = require('./voice-gateway');

const result = await voiceGw.transcribe(
  {
    source: 'telegram',
    sourceData: {
      botToken: process.env.NEXUS_TELEGRAM_BOT_TOKEN,
      fileId,
      mimeType: 'audio/ogg',
      durationSec,
      isVoice: true,
    },
    language: 'vi',
    // provider: 'whisper',  // default
    // skipQueue: false,     // default false
  },
  { service: 'nexus-bot', scope: 'nexus', userId: msg.from.id },
);
// result: { outcome:'ok', text:'...', model:'gpt-4o-mini-transcribe', durationSec, bytes, costUsd, latencyMs }
// or:     { outcome:'denied', denyReason:'L4_rate_limit', latencyMs }
// or:     { outcome:'error',  denyReason:'L1_adapter',    latencyMs }
```

### Queue stats (admin)

```js
voiceGw.queueStats(); // { active, pending, maxConcurrent, maxQueued }
```

## Sources

| source     | sourceData fields                                              |
| ---------- | -------------------------------------------------------------- |
| `telegram` | `botToken`, `fileId`, `mimeType`, `durationSec`, `isVoice`     |
| `whatsapp` | (P4 — not implemented)                                         |
| `wechat`   | (P4 — not implemented)                                         |
| `http`     | (P4 — not implemented)                                         |
| `file`     | (P4 — not implemented)                                         |

Helper: `require('./voice-gateway/sources/telegram').pickAudioSource(msg)` — extract `{fileId, mimeType, isVoice, durationSec}` from a Telegram update.

## Providers

| provider   | env vars                                                                      |
| ---------- | ----------------------------------------------------------------------------- |
| `whisper`  | `VOICE_GW_WHISPER_API_KEY_ENV` (default `OPENAI_API_KEY`), `VOICE_GW_WHISPER_MODEL`, `VOICE_GW_WHISPER_BASE_URL` |
| `gemini`   | (P5 — not implemented)                                                        |
| `local`    | (P5 — not implemented)                                                        |

## Env config

| Var                              | Default                       |
| -------------------------------- | ----------------------------- |
| `VOICE_GW_MAX_CONCURRENT`        | `2`                           |
| `VOICE_GW_MAX_QUEUED`            | `100`                         |
| `VOICE_GW_QPS_PER_MIN`           | `30`                          |
| `VOICE_GW_DAILY_COST_USD`        | `5`                           |
| `VOICE_GW_WHISPER_MODEL`         | `gpt-4o-mini-transcribe`      |
| `VOICE_GW_WHISPER_BASE_URL`      | `https://api.openai.com/v1`   |
| `VOICE_GW_WHISPER_API_KEY_ENV`   | `OPENAI_API_KEY`              |
| `VOICE_GW_WHISPER_USD_PER_MIN`   | `0.006`                       |

## Deny reasons

| reason                | layer | meaning                                               |
| --------------------- | ----- | ----------------------------------------------------- |
| `L2_unknown_caller`   | L2    | caller missing service or scope                       |
| `L3_authz`            | L3    | source/provider not allowed for caller                |
| `L4_rate_limit`       | L4    | per-service QPS exceeded OR queue full                |
| `L4_cost_cap`         | L4    | daily $ budget exceeded                               |
| `L1_source`           | L1    | source name not registered                            |
| `L1_adapter`          | L1    | provider name not registered                          |
| `L1_too_large`        | L1    | file exceeded `maxBytes`                              |
| `L1_empty`            | L1    | source returned empty buffer                          |

## Cấm tuyệt đối

- ❌ Direct import của OpenAI/Whisper SDK ngoài `adapters/`.
- ❌ Direct fetch Telegram CDN ngoài `sources/telegram.js`.
- ❌ Bypass identity / authz / audit log.
- ❌ Persist audio bytes — gateway streams in-memory only.

## Sanity check (pre-commit)

```bash
grep -rn "fetch.*api.openai.com/v1/audio\|fetch.*api.telegram.org/file" . \
  --include="*.js" \
  --exclude-dir=adapters --exclude-dir=sources --exclude-dir=node_modules
```

Phải rỗng — mọi external call qua adapters/sources only.

## Phase roadmap

| Phase | Scope                                                                 |
| ----- | --------------------------------------------------------------------- |
| P1    | Skeleton + Telegram source + Whisper adapter + queue (this commit)    |
| P2    | Pilot trong nexus — refactor `voice-stt.js`/`voice-pending-store.js`  |
| P3    | Wire vào framework Telegram bot                                       |
| P4    | Sources: WhatsApp, HTTP upload                                        |
| P5    | Adapters: Gemini STT, local Whisper; failover                         |
