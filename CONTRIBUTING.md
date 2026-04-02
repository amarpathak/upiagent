# Contributing to upiagent

Thanks for your interest in contributing! Here's how to get started.

## Setup

```bash
# Clone the repo
git clone https://github.com/AmarPathak/upiagent.git
cd upiagent

# Install dependencies (requires pnpm)
pnpm install

# Build the core package
pnpm --filter @upiagent/core build

# Run tests
pnpm --filter @upiagent/core test
```

## Project structure

```
packages/core/     → The open-source library (npm: upiagent)
apps/www/          → Marketing site
apps/dashboard/    → Merchant dashboard
```

All open-source work happens in `packages/core/`.

## Making changes

1. Fork the repo and create a branch from `main`
2. Make your changes in `packages/core/src/`
3. Add or update tests in `packages/core/src/**/*.test.ts`
4. Run `pnpm --filter @upiagent/core test` to make sure everything passes
5. Run `pnpm --filter @upiagent/core lint` to check for lint errors
6. Open a pull request against `main`

## What to work on

- Check [open issues](https://github.com/AmarPathak/upiagent/issues) for bugs and feature requests
- Issues labeled `good first issue` are a great starting point
- If you want to add a major feature, open an issue first to discuss it

## Code style

- TypeScript, strict mode
- No default exports — use named exports
- Keep functions small and focused
- Add JSDoc comments for public APIs

## Adding a new bank pattern

If you want to add support for a new bank's email format:

1. Open `packages/core/src/security/bank-registry.ts`
2. Add the bank's email patterns (sender address + keywords)
3. Add a test with a sample email from that bank
4. Open a PR

## Questions?

Open an issue or start a discussion on GitHub.
