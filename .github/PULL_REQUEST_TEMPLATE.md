## Summary

<!-- 1-3 bullets on what changed and why -->

## Checklist

- [ ] `npm test` passes
- [ ] Sanity grep empty (no direct SDK / CDN fetch outside `adapters/` / `sources/`)
- [ ] No secrets in diff (no `sk-`, no bot tokens, no `.env`)
- [ ] Default-deny preserved (identity → authz → rate-limit → cost-cap → audit)
- [ ] No audio bytes persisted to disk
- [ ] README updated (env vars, deny reasons, sources, providers)
- [ ] `transcribe()` still never throws

## Test plan

<!-- How did you verify? -->
