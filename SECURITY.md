# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in `@kanelr/voice-gateway`, please
report it privately to <security@acegalaxy.co>.

**Do not** open a public GitHub issue for security vulnerabilities.

We aim to acknowledge reports within 72 hours and provide a fix or mitigation
within 14 days for high-severity issues.

## Scope

This package wraps OpenAI Whisper and downloads audio from messaging platforms
(Telegram, etc.). Security-relevant issues include:

- Bypassing the default-deny authz layer
- Bypassing rate-limit / cost-cap
- Bypassing the audit log
- Unintended audio persistence on disk
- Leaking API keys (OpenAI, Telegram bot token) to logs / errors / stdout
- Server-Side Request Forgery (SSRF) via source `fileId`

## Out of scope

- Vulnerabilities in OpenAI API itself — report to OpenAI.
- Vulnerabilities in `node-telegram-bot-api` or other deps — report upstream.

## Supported versions

Only the latest minor version (`0.1.x`) receives security patches during pre-1.0.
