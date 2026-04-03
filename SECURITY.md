# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

**Do NOT open a public issue for security vulnerabilities.**

Report privately via:
- [GitHub Security Advisories](https://github.com/amarpathak/upiagent/security/advisories/new)

We aim to acknowledge within 48 hours and patch critical issues within 7 days.

## Threat Model

upiagent verifies UPI payments by parsing bank alert emails with an LLM. The primary threats are:

1. **Fraudulent payment claims** — attacker tries to get credit for a payment they didn't make
2. **Replay attacks** — attacker reuses a legitimate payment notification for multiple credits
3. **Prompt injection** — attacker crafts email content to manipulate LLM output
4. **Email spoofing** — attacker sends fake bank alerts to the merchant's Gmail

## Security Architecture

### 5-Layer Validation Pipeline

Every payment goes through these layers in order. A failure at any layer rejects the payment.

| Layer | Threat Mitigated | Implementation |
|-------|-----------------|----------------|
| Format validation | Malformed LLM output | Zod schema validation |
| Bank source check | Email spoofing | Sender address pattern matching |
| Amount matching | Fraudulent amount claims | Exact or tolerance-based comparison |
| Time window | Stale/replayed payments | Configurable window (default: 30 min) |
| Deduplication | Replay attacks | UPI reference ID tracking |

### Prompt Injection Defense

- Zero-width character stripping (NFKC normalization)
- Blocklist regex for common injection patterns
- JSON-like content removal
- Input truncation (200 chars subject, 2000 chars body)
- **Primary defense:** LLM structured output (function calling), not text parsing

### Encryption

- AES-256-GCM for credential storage
- Random IV per encryption operation
- Authentication tag prevents tampering

## Known Limitations

These are documented trade-offs, not bugs. They should be addressed before using upiagent in high-value production environments.

### Email From Header Trust (Medium Risk)

The bank source validation checks the `From` header email address against known bank patterns. Email `From` headers can be spoofed. Gmail marks spoofed emails, but the library doesn't currently inspect DKIM/SPF/DMARC authentication results.

**Mitigation:** Gmail's spam filter catches most spoofed bank emails before they reach the inbox. For additional security, inspect the `Authentication-Results` header.

**Tracked:** [#1](https://github.com/amarpathak/upiagent/issues/1)

### UTR Hint Amount Bypass (High Risk)

When a UTR (Unique Transaction Reference) hint matches, the amount validation layer is skipped entirely. An attacker who can register a UTR hint could bypass amount checking — a small payment with the correct UTR would pass verification for a large expected amount.

**Mitigation:** Only accept UTR hints from trusted sources (the paying customer's direct input). Never accept UTR hints from untrusted channels.

**Tracked:** [#2](https://github.com/amarpathak/upiagent/issues/2)

### Prompt Injection Blocklist (Low-Medium Risk)

The `sanitizeEmailForLlm` function uses a blocklist approach, which is inherently bypassable. Sophisticated attackers could use Unicode tricks, HTML entity splitting, or RTL override characters to evade the blocklist.

**Mitigation:** The blocklist is defense-in-depth. The primary defense is LLM structured output (function calling / tool use), which constrains the output format regardless of input manipulation. The 5-layer security pipeline catches most attacks that slip past the LLM.

**Tracked:** [#3](https://github.com/amarpathak/upiagent/issues/3)

### Webhook SSRF (Low Risk)

`validateWebhookUrl` blocks localhost and private IP ranges but doesn't protect against DNS rebinding attacks or cloud metadata endpoints via alternative hostnames.

**Mitigation:** Run webhook delivery from a network segment that can't reach internal services. Use an allowlist for webhook domains in production.

**Tracked:** [#4](https://github.com/amarpathak/upiagent/issues/4)

### InMemoryDedupStore Restart Risk (Low Risk)

The in-memory dedup store clears on process restart, allowing replay of previously-seen UPI reference IDs.

**Mitigation:** Use `PostgresDedupStore` in production. Add a database-level unique constraint on UPI reference IDs as belt-and-suspenders.

**Already documented in README.**

## Security Checklist for Contributors

Before submitting security-related PRs:

- [ ] Added test that demonstrates the vulnerability
- [ ] Added test that verifies the fix
- [ ] No silent fallbacks — failures are logged
- [ ] Fails closed — errors reject payments, not accept them
- [ ] Updated this file if the threat model changed
