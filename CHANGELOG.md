# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Android UPI notification parser (`parseNotification`, `isKnownUpiApp`) — verifies payments from app notifications with no LLM call
- `rateLimitKey` option to bucket the LLM rate limiter per merchant/tenant
- Deterministic bank display names from the sender registry
- `upiagent/contracts`: Zod schemas + inferred types for every API request/response and the webhook payload — the same definitions the hosted API validates against
- Email pre-screen before the extraction LLM: `EmailClassifier` interface, a free `RulesClassifier`, and `JevClassifier` on TypeSafe's Jev model (calibrated credit/debit/OTP/statement/promotional probabilities plus a forged-or-manipulative signal). Opt in with `verifyPayment(email, { classifier })`; classifier failures fall through to the LLM, and the classifier never decides that a payment happened
- `extractPayment` / `matchParsedPayment`: parse an email once, then match it against many expected payments with no further LLM calls (`verifyPayment` is now these two composed)
- Client SDK validates API responses against the contracts and throws `UpiAgentApiError` on an unexpected shape instead of casting

### Changed

- Client SDK types are inferred from the contracts: nullable fields (`note`, `upiReferenceId`, …) are typed `string | null | undefined`, and `VerifyResult.status` is the `PaymentStatus` union rather than `string`
- Client SDK URL-encodes payment IDs

### Fixed

- Token metering read the wrong usage shape for Anthropic responses and recorded zero tokens, silently disabling budgets
- Pre-LLM gate now requires credit direction, so debit alerts, OTPs and statements no longer reach the LLM
- Webhook SSRF check: private-range patterns apply only to IP literals (hostnames like `fdic.gov` were rejected) and IPv4-mapped IPv6 addresses are blocked

### Security

- Step logs no longer record email body snippets

## [0.1.0] - 2026-04-03

### Added

- UPI QR code generation (PNG data URL and SVG string)
- Gmail-based payment verification with LLM parsing
- Multi-provider LLM support: OpenAI, Anthropic, Gemini, OpenRouter, OpenAI-compatible
- 5-layer security validation pipeline (format, bank source, amount, time window, dedup)
- Duplicate transaction detection with in-memory and PostgreSQL stores
- Managed verification sessions with UTR escalation
- HMAC-signed webhook delivery with retry
- AES-256-GCM credential encryption
- CLI for Gmail OAuth setup (`npx upiagent setup`)
- 15 pre-registered Indian bank patterns
- Environment validation utilities (`validateGmailEnv`, `validateLlmEnv`)
- Cost tracking, rate limiting, and pipeline step logging
