# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
