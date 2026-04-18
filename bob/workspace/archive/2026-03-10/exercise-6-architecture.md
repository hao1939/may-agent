# Architecture Principles

## Core Design Values

1. **Separation of Concerns** — Each component has a single responsibility
2. **Fail Fast** — Detect errors at the boundary, not deep in the stack
3. **Explicit over Implicit** — Configuration should be visible and readable
4. **Observability First** — Every service must emit structured logs and metrics from day one

## Component Guidelines

- Services should expose health endpoints
- Configuration loaded at startup, not at request time
- Retry logic belongs in the caller, not the callee
