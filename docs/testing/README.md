# Testing Documentation

This area will hold `ACCEPTANCE_TESTS.md` and supporting test strategy.

Planned coverage includes Angular unit/component tests, contract-adapter tests, accessibility checks, and Playwright user journeys where practical. Each feature must cover the applicable happy path, validation, unauthorized/forbidden state, loading, empty, error/retry, stale data, and reconnect/reconciliation behavior.

Lint, typecheck, tests, and production build must run in implementation PRs. Physical GPS, deployed provider, OAuth, and real Traccar checks are separate owner/operator evidence and must never be represented as automated passes.
