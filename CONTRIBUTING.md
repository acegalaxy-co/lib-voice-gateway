# Contributing to @kanelr/voice-gateway

Thanks for your interest! This package is part of the [ace_commons](https://github.com/acegalaxy-co) collection.

## Ground rules

- **Default-deny stays default-deny.** Any new source/adapter MUST go through identity → authz → rate-limit → cost-cap → queue → audit.
- **No direct STT SDK imports outside `adapters/`.** No direct CDN fetch outside `sources/`.
- **No persisting audio bytes.** Gateway streams in-memory only.
- **`transcribe()` never throws.** Always returns `{ outcome, denyReason?, ... }`.

## Dev setup

```bash
git clone https://github.com/acegalaxy-co/ace_commons-voice-gateway-nodejs.git
cd ace_commons-voice-gateway-nodejs
npm install
npm test
```

## Pull request checklist

- [ ] Smoke test passes (`npm test`)
- [ ] Sanity grep is empty (see README "Sanity check")
- [ ] No secrets in diff
- [ ] New env vars documented in README
- [ ] New deny reasons documented in README

## Reporting bugs / requesting features

Open an issue at <https://github.com/acegalaxy-co/ace_commons-voice-gateway-nodejs/issues>.

## Code of Conduct

By participating, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).
