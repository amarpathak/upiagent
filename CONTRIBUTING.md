# Contributing to upiagent

Thanks for your interest in contributing! This is a financial library — correctness and security matter more than speed.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/amarpathak/upiagent.git
cd upiagent

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm run test

# Lint
npm run lint
```

## Running Integration Tests

Integration tests require real Gmail and LLM credentials. Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
# Edit .env with your credentials
npm run test
```

Unit tests (in `src/**/__tests__/`) run without any credentials.

## Pull Request Process

1. Fork the repo and create your branch from `main`
2. Write tests for any new functionality
3. Ensure `npm run lint` and `npm run test` pass
4. Keep PRs focused — one feature or fix per PR
5. Update the README if you're changing the public API
6. For security-related changes, add a test that demonstrates the vulnerability and its fix

## Code Style

- ESLint and Prettier are configured — run `npm run lint` before submitting
- TypeScript strict mode is enforced
- Prefer explicit types over `any`
- All public functions must have JSDoc comments
- Error messages must be actionable — tell the user what to do, not just what went wrong

## Security

This library handles real money. Security issues get priority over everything else.

### Reporting Vulnerabilities

**Do NOT open a public issue for security vulnerabilities.**

Instead, report them privately:
- Email: **security@upiagent.dev** (or your preferred contact)
- Or use [GitHub's private vulnerability reporting](https://github.com/amarpathak/upiagent/security/advisories/new)

Include:
- Description of the vulnerability
- Steps to reproduce or proof of concept
- Impact assessment (what can an attacker do?)
- Suggested fix if you have one

We aim to acknowledge within 48 hours and patch critical issues within 7 days.

### Security Design Principles

When contributing security-related code, follow these principles:

1. **Fail closed** — if a check errors out, reject the payment. Never fail open.
2. **Defense in depth** — no single layer should be the only thing preventing fraud. Multiple layers must independently catch attacks.
3. **No silent fallbacks** — if a security check is skipped or degraded, log it at `warn` level minimum.
4. **Structured output over parsing** — prefer LLM function calling / tool use over regex parsing of LLM text output.
5. **Assume emails are hostile** — every field in an email (from, subject, body, headers) can be spoofed or crafted.

### Known Security Considerations

See [SECURITY.md](SECURITY.md) for the current threat model and known limitations.

## Reporting Bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your Node.js version and OS

## Issue Labels

| Label | Meaning |
|-------|---------|
| `bug` | Something is broken |
| `enhancement` | New feature or improvement |
| `security` | Security-related issue (non-critical, public) |
| `good first issue` | Good for new contributors |
| `help wanted` | Extra attention needed |

## Architecture Overview

If you're contributing for the first time, here's how the modules connect:

```
createPayment() → QR code → Customer pays → Bank sends email
                                                    ↓
fetchAndVerifyPayment() → GmailClient.fetchBankAlerts()
                                                    ↓
                          Pre-LLM gate (bank registry check)
                                                    ↓
                          parsePaymentEmail() → LLM extraction
                                                    ↓
                          SecurityValidator.validate() → 5 layers
                                                    ↓
                          VerificationResult { verified, payment, confidence }
```

Each module (`payment/`, `gmail/`, `llm/`, `security/`, `session/`, `webhook/`, `utils/`) is independent with its own types file. Start by reading the module you want to change.
