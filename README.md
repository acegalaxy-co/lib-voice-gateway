# @acegalaxy/lib-voice-gateway

> **OpenAI Whisper wrapper với cost cap + rate limit + audit — production-ready STT cho Telegram bots.**

Multi-source speech-to-text gateway với 5-layer security (caller identity, default-deny authz, rate limit, daily cost cap, bounded queue, append-only audit log). Built for Telegram voice/audio/video_note messages but works with any audio file path.

## Why

Calling Whisper directly from a Telegram bot is one runaway loop away from a $200 OpenAI bill. `voice-gateway` funnels every transcription through:

1. **Identity** — who is calling (service + scope)
2. **Authz** — is this caller allowed to use this source × provider
3. **Rate limit** — per-service QPS
4. **Cost cap** — daily USD budget per service
5. **Queue** — bounded concurrency, no unbounded fan-out
6. **Audit log** — append-only record of every call

`transcribe()` **never throws** — it returns `{ outcome: 'ok' | 'denied' | 'error', ... }`. Your bot stays up.

## Install

```json
"dependencies": {
  "@acegalaxy/lib-voice-gateway": "github:acegalaxy-co/lib-voice-gateway#v0.2.0"
}
```

Requires Node `>=20`.

This package's git-dependency on `@acegalaxy/lib-security-utils` means CI needs the org secret `LIB_DEPS_TOKEN` (read-only fine-grained PAT) to resolve it.

## Quick start — Telegram bot voice message

```js
const TelegramBot = require('node-telegram-bot-api');
const voiceGw = require('@acegalaxy/lib-voice-gateway');
const { pickAudioSource } = require('@acegalaxy/lib-voice-gateway/sources/telegram');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

bot.on('message', async (msg) => {
  const audio = pickAudioSource(msg); // { fileId, mimeType, isVoice, durationSec } or null
  if (!audio) return;

  const result = await voiceGw.transcribe(
    {
      source: 'telegram',
      sourceData: { botToken: process.env.TELEGRAM_BOT_TOKEN, ...audio },
      language: 'vi',
    },
    { service: 'my-bot', scope: 'public', userId: msg.from.id },
  );

  if (result.outcome === 'ok') {
    bot.sendMessage(msg.chat.id, `📝 ${result.text}\n\n_$${result.costUsd.toFixed(4)}_`);
  } else if (result.outcome === 'denied' && result.denyReason === 'L4_cost_cap') {
    bot.sendMessage(msg.chat.id, '⚠️ Daily voice budget exhausted, try tomorrow.');
  } else {
    bot.sendMessage(msg.chat.id, `❌ ${result.denyReason}`);
  }
});
```

That's it. Cost cap, rate limit, and audit log are automatic.

## API

```js
const result = await voiceGw.transcribe(request, caller);
```

**`request`**
| field | type | notes |
| --- | --- | --- |
| `source` | `'telegram'` \| `'file'` | source name |
| `sourceData` | object | source-specific (see below) |
| `language` | string | ISO 639-1, e.g. `'vi'`, `'en'` |
| `provider` | string | default `'whisper'` |
| `skipQueue` | boolean | default `false` |

**`caller`** — `{ service: string, scope: string, userId?: string|number }`

**`result`** — never throws:
- `{ outcome: 'ok',     text, model, durationSec, bytes, costUsd, latencyMs }`
- `{ outcome: 'denied', denyReason, latencyMs }`
- `{ outcome: 'error',  denyReason, latencyMs }`

### Admin

```js
voiceGw.queueStats(); // { active, pending, maxConcurrent, maxQueued }
```

## Sources

| source     | sourceData fields                                          |
| ---------- | ---------------------------------------------------------- |
| `telegram` | `botToken`, `fileId`, `mimeType`, `durationSec`, `isVoice` |
| `file`     | `path` (local audio file)                                  |

Telegram helper: `require('@acegalaxy/lib-voice-gateway/sources/telegram').pickAudioSource(msg)` extracts voice / audio / video_note from any Telegram update.

## Providers

| provider  | env vars                                                                |
| --------- | ----------------------------------------------------------------------- |
| `whisper` | `OPENAI_API_KEY` (or `VOICE_GW_WHISPER_API_KEY_ENV`), `VOICE_GW_WHISPER_MODEL` |

## Env config

| Var                            | Default                     |
| ------------------------------ | --------------------------- |
| `VOICE_GW_MAX_CONCURRENT`      | `2`                         |
| `VOICE_GW_MAX_QUEUED`          | `100`                       |
| `VOICE_GW_QPS_PER_MIN`         | `30`                        |
| `VOICE_GW_DAILY_COST_USD`      | `5`                         |
| `VOICE_GW_WHISPER_MODEL`       | `gpt-4o-mini-transcribe`    |
| `VOICE_GW_WHISPER_BASE_URL`    | `https://api.openai.com/v1` |
| `VOICE_GW_WHISPER_API_KEY_ENV` | `OPENAI_API_KEY`            |
| `VOICE_GW_WHISPER_USD_PER_MIN` | `0.006`                     |

## Deny reasons

| reason              | layer | meaning                                    |
| ------------------- | ----- | ------------------------------------------ |
| `L1_source`         | L1    | source name not registered                 |
| `L1_adapter`        | L1    | provider name not registered               |
| `L1_too_large`      | L1    | file exceeded `maxBytes`                   |
| `L1_empty`          | L1    | source returned empty buffer               |
| `L2_unknown_caller` | L2    | caller missing `service` or `scope`        |
| `L3_authz`          | L3    | source/provider not allowed for caller     |
| `L4_rate_limit`     | L4    | per-service QPS exceeded OR queue full     |
| `L4_cost_cap`       | L4    | daily $ budget exceeded                    |

## Hard rules

- ❌ No direct OpenAI/Whisper SDK import outside `adapters/`.
- ❌ No direct Telegram CDN fetch outside `sources/telegram.js`.
- ❌ No bypass of identity / authz / audit log.
- ❌ No persisting audio bytes — streams in-memory only.

## Sanity check (pre-commit)

```bash
grep -rn "fetch.*api.openai.com/v1/audio\|fetch.*api.telegram.org/file" . \
  --include="*.js" \
  --exclude-dir=adapters --exclude-dir=sources --exclude-dir=node_modules
```

Must be empty.

## License

[MIT](LICENSE) © 2026 ACE Galaxy

## Related

- [@acegalaxy/lib-db-gateway](https://github.com/acegalaxy-co/lib-db-gateway) — same pattern for databases
- [@acegalaxy/lib-ott-gateway](https://github.com/acegalaxy-co/lib-ott-gateway) — same pattern for messaging
