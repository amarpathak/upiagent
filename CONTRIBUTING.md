# Contributing to upiagent

Thanks for your interest in contributing!

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

## Code Style

- ESLint and Prettier are configured — run `npm run lint` before submitting
- TypeScript strict mode is enforced
- Prefer explicit types over `any`

## Reporting Bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your Node.js version and OS
