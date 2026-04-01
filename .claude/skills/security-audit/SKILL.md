---
name: security-audit
description: >
  Systematic security audit for full-stack TypeScript/Next.js applications — covers API route auth,
  credential handling, injection attacks (SQL, XSS, prompt injection), OAuth flows, payment integrity,
  rate limiting, secrets management, RLS policies, and dependency vulnerabilities. Use this skill
  whenever the user mentions security, audit, vulnerability, penetration test, hardening, threat model,
  OWASP, or wants to review code for security issues. Also trigger when editing API routes, auth logic,
  payment flows, encryption code, or middleware — even if the user doesn't explicitly say "security".
---

# Security Audit

A structured, repeatable security audit for full-stack TypeScript applications with payment flows,
OAuth integrations, and LLM-powered features.

## Why this skill exists

Security issues in payment systems and credential-handling code are high-severity by nature — a single
missed validation can lead to financial loss, credential theft, or regulatory trouble. This skill
ensures nothing gets skipped by walking through every attack surface methodically rather than relying
on memory or intuition.

## How to run the audit

### Phase 1: Reconnaissance (understand what you're auditing)

Before checking anything, build a mental map of the application:

1. **Identify entry points** — List every API route, server action, webhook handler, and middleware.
   Use: `find apps/*/src/app/api -name "route.ts"` and check for `proxy.ts` / `middleware.ts`.

2. **Map data flows** — For each entry point, trace: where does user input arrive? What
   transformations happen? Where does it end up (database, external API, LLM prompt, browser)?

3. **Identify trust boundaries** — Where does the app cross from trusted to untrusted?
   - Browser ↔ Server (API routes)
   - Server ↔ Database (queries, RLS)
   - Server ↔ External APIs (Gmail, LLM providers, UPI)
   - User input ↔ LLM prompt (injection surface)

4. **Catalog secrets** — List every environment variable that contains a secret. Check `.env.example`,
   `next.config.ts`, and grep for `process.env`.

### Phase 2: Systematic checklist audit

Work through each category below. For each finding, record:
- **Severity**: Critical / High / Medium / Low / Info
- **Location**: file:line
- **Issue**: What's wrong
- **Impact**: What an attacker could do
- **Fix**: Concrete remediation

Read `references/checklist.md` for the detailed checklist items per category.

The categories (in priority order for payment apps):

1. **Authentication & Authorization** — Every route protected? Service role key exposure? Session handling?
2. **Credential & Secrets Management** — Encryption at rest? Key rotation? Env var leaks?
3. **Payment Integrity** — Amount manipulation? Replay attacks? Race conditions? Time window abuse?
4. **Input Validation & Injection** — SQL injection? XSS? Command injection? Path traversal?
5. **Prompt Injection** — LLM input sanitization? Output validation? Indirect injection via email content?
6. **OAuth & Token Security** — CSRF protection? Token storage? Scope validation? Redirect URI validation?
7. **Rate Limiting & DoS** — All public endpoints limited? Bypass via header spoofing? Resource exhaustion?
8. **Database Security** — RLS policies on all tables? Service role usage minimized? Query parameterization?
9. **Transport & Headers** — HTTPS enforced? Security headers (CSP, HSTS, X-Frame-Options)? Cookie flags?
10. **Dependency & Supply Chain** — Known CVEs? Lockfile integrity? Unused dependencies with broad access?

### Phase 2.5: Freestyle exploration pass

After completing the structured checklist, do an open-ended exploration pass. The checklist catches known
categories, but real vulnerabilities often hide in the gaps between categories. Read through critical code
paths end-to-end (not just checking categories) and look for issues the checklist didn't cover.

Pay special attention to:

- **Code that EXISTS but isn't USED** — e.g., a validation library is imported or a helper function is
  defined, but the actual routes bypass it entirely. The existence of security code creates a false sense
  of safety if nothing calls it.
- **Discrepancies between what code CLAIMS to do vs what it ACTUALLY does** — e.g., a comment says
  "validates payment amount" but the function only checks if the field is present, not its value.
- **Implicit security dependencies** — things the app relies on for security but doesn't verify itself.
  Example: relying on Gmail's SPF/DKIM to guarantee sender identity without documenting that assumption
  or verifying those headers in app code.
- **Cross-cutting concerns that fall between checklist categories** — e.g., a race condition in OAuth
  token refresh that isn't purely an "OAuth issue" or a "database issue" but lives at the intersection.

This phase often catches the highest-severity findings because it mimics how a real attacker approaches
a system — holistically, not by category.

### Phase 3: Automated checks

Run these commands as part of every audit:

```bash
# Dependency vulnerabilities
pnpm audit --audit-level=moderate 2>/dev/null || npm audit --audit-level=moderate

# Search for hardcoded secrets patterns
grep -rn "sk-[a-zA-Z0-9]" --include="*.ts" --include="*.tsx" --include="*.js" .
grep -rn "AIza[0-9A-Za-z_-]" --include="*.ts" --include="*.tsx" .
grep -rn "password\s*[:=]\s*['\"]" --include="*.ts" --include="*.tsx" .

# Check .gitignore covers sensitive files
cat .gitignore | grep -E "\.env|credentials|secret"

# Check for console.log leaking sensitive data in API routes
grep -rn "console\.log" apps/*/src/app/api/ --include="*.ts"

# Check service role key usage (should be server-side only)
grep -rn "SUPABASE_SERVICE_ROLE_KEY" --include="*.ts" --include="*.tsx" .
```

### Phase 4: Report

Output a structured report with this format:

```markdown
# Security Audit Report — [Project Name]
**Date**: YYYY-MM-DD
**Scope**: [what was audited]
**Auditor**: Claude Code

## Executive Summary
[1-2 sentences: overall posture, critical finding count]

## Findings

### [CRITICAL/HIGH/MEDIUM/LOW]-001: [Title]
- **Category**: [from Phase 2 list]
- **Location**: `file/path.ts:42`
- **Description**: [what's wrong]
- **Impact**: [what an attacker could do]
- **Remediation**: [specific fix with code example if helpful]
- **Status**: Open

## Positive Findings
[Security measures that are working well — this section is REQUIRED, not optional.
List concrete things the codebase does right: encryption implementations, proper auth checks,
good input validation patterns, etc. This provides balance and reinforces good practices so
they aren't accidentally removed in future refactors.]

## Recommendations
[Prioritized list of improvements beyond specific findings]
```

After generating the markdown report, also generate a machine-readable findings file and an interactive
HTML dashboard:

1. **Generate `findings.json`** in the report output directory with this structure:
   ```json
   {
     "meta": { "project": "...", "date": "...", "scope": "..." },
     "findings": [
       { "id": "CRITICAL-001", "severity": "critical", "title": "...", "category": "...", "location": "...", "description": "...", "impact": "...", "remediation": "...", "status": "open" }
     ],
     "positive_findings": [
       { "title": "...", "description": "...", "category": "..." }
     ],
     "summary": { "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0 }
   }
   ```

2. **Run the dashboard generator** to produce an interactive HTML report:
   ```bash
   node .claude/skills/security-audit/scripts/generate-dashboard.mjs findings.json
   ```
   If the script doesn't exist yet, skip this step and note it in the report output.

### Severity guide

| Severity | Criteria | Example |
|----------|----------|---------|
| Critical | Exploitable now, leads to data breach or financial loss | Unauthenticated API route that modifies payments |
| High | Exploitable with moderate effort, significant impact | Missing CSRF on OAuth callback |
| Medium | Requires specific conditions, limited impact | Rate limit bypassable via IP rotation |
| Low | Defense-in-depth gap, minimal direct impact | Missing security headers on non-sensitive page |
| Info | Best practice recommendation, no direct vulnerability | Console.log in production API route |

## Important principles

- **Never skip a category** even if you think it's fine. The whole point is being systematic.
- **Read the actual code**, don't assume based on file names. A file called `middleware.ts` might not actually check auth.
- **Check the negative case** — what happens when auth fails? When validation rejects? When the token is expired? Error paths are where bugs hide.
- **Think like an attacker** — for each endpoint ask: "If I were trying to steal money or credentials from this system, how would I do it?" Specifically consider these attack scenarios:
  - "Can I replay a previously valid transaction?" (reuse a bank SMS, webhook, or UPI reference)
  - "Can I trigger expensive operations (LLM calls, API calls) cheaply?" (one cheap HTTP request that fans out to costly downstream calls)
  - "Does any validation only happen client-side or in-memory that should be at database level?" (e.g., uniqueness checks without DB constraints)
  - "Are there code paths where well-designed security libraries/functions exist but are simply not called?" (dead security code)
  - "What implicit assumptions does the security model make?" (e.g., email sender is verified by Gmail SPF/DKIM, not by app code — is that documented and acceptable?)
- **Don't report mock/theoretical issues** — only report things you can trace to actual code. If you can't point to a file and line number, it's not a finding.
