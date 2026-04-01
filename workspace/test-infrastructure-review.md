# Test Infrastructure Review

**Date**: 2026-03-15  
**Reviewer**: tech-lead  

## Summary

The project uses **Vitest ^3.2.4** as its sole test framework, run via `bun vitest --run` (npm script: `npm test`). There is **no dedicated vitest.config or jest.config file** — Vitest runs with default configuration and discovers test files by convention (`*.test.ts`).

## Test File Inventory

| Location | File Count | Description |
|---|---|---|
| `test/` (root level) | 81 | Core test suites — unit and integration tests for the agent framework |
| `test/handlers/` | 6 | Handler-specific tests (coaching-report, daily-brief, evaluate-sessions, system-status, todo-utils, watchdog) |
| `test/gym/` | 1 | Gym harness test (`gym.test.ts`) |
| `agents/` (exercise files) | 12 | Coach and tech-lead exercise/graduation test files (picked up by vitest autodiscovery) |
| **Total** | **100** | **100 test files, 1281 tests** |

## Test Support Files

- `test/scenarios.ts` — shared test scenario utilities
- `test/smoke.ts` — smoke test helper
- `test/gym/gym-harness.ts` — gym exercise harness

## Configuration

- **Framework**: Vitest ^3.2.4
- **Runner**: `bun vitest --run` (configured in `package.json` scripts)
- **Config file**: None — uses Vitest defaults (convention-based test discovery)
- **TypeScript**: Compiled with `tsconfig.json` targeting ES2022, NodeNext module resolution
- **Linting**: ESLint configured for `src/` and `test/`
- **Formatting**: Prettier configured for `src/**/*.ts` and `test/**/*.ts`

## Test Categories (by file name patterns)

- **Tool tests**: edit-tool, write-tool, create-tool, exec-tool, cron-tool, agents-tool, handoff-tool, workflow-tool
- **Session/persistence**: session-jsonl, session-graph, session-tree, session-count, session-exists, session-prefix, persistence, send-persistence
- **Agent lifecycle**: agent-loader, agent-count, agent-growth, agent-scores, resume-agent, launcher, shutdown
- **Robustness/reliability**: crash-recovery, cascading-cancel, failure-chains, protocol-violations, robustness, edge-cases, timeout, silent-error
- **Memory/compaction**: compaction, rolling-compaction, memory-prompt, memory-truncation, overflow
- **Workflow**: workflow-composition, workflow-dir, workflow-resume, workflow-tool, stale-workflow-runs
- **Infrastructure**: health-check, health-api, system-status, resource-awareness, bash-resource-caps, concurrency-gate, operation-budget
- **Handlers**: coaching-report, daily-brief, evaluate-sessions, system-status, todo-utils, watchdog

## Health Status

As of this review:
- ✅ **100/100 test files passing**
- ✅ **1281/1281 individual tests passing**
- ✅ **TSC clean (zero type errors)**
- ✅ **Duration**: ~18s total (transform 10.5s, collect 134s, tests 36s)

## Notable Observations

1. **No config file**: Vitest uses pure defaults — no custom setup, reporters, or environment overrides. This keeps things simple but means all configuration is implicit.
2. **Exercise tests included**: 12 test files under `agents/` (coach/tech-lead exercise directories) are picked up by vitest's default glob. These are training/graduation exercises, not core framework tests.
3. **No test isolation config**: No `setupFiles`, `globalSetup`, or `environment` overrides detected — tests are self-contained.
4. **Large test suite**: 1281 tests across 100 files is substantial. The largest suites are compaction (50 tests), handoff (45 tests), and failure-chains (42 tests).
