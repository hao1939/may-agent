# New Agent Onboarding Guide

## Status: COMPLETE

## 1. System Architecture

```
agents/shared/
├── workflows/    # Core workflow implementations (TypeScript)
├── tests/        # Unit, integration, and failure-injection tests (Vitest)
├── scripts/      # Automation tools (bash, executable)
├── projects/     # Project tracking and outputs
└── utils/        # Shared utilities (circuit-breaker, helpers)
```

Workflows are the primary unit of work. Each workflow exports an `execute()` function that orchestrates LLM calls through a master-worker pattern.

## 2. Available Tools

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/test-gate.sh` | CI gate — fails if any test fails | `./scripts/test-gate.sh` |
| `scripts/system-health.sh` | Full system status report | `./scripts/system-health.sh` |
| `scripts/scaffold-workflow.sh` | Generate new workflow + test skeleton | `./scripts/scaffold-workflow.sh my-workflow` |
| `scripts/nightly-health.sh` | Dated health report for tracking | `./scripts/nightly-health.sh` |
| `scripts/workflow-quality-score.sh` | Grade all workflows on 5 criteria | `./scripts/workflow-quality-score.sh` |

## 3. Key Patterns

### Error Handling
All async operations must be wrapped in try/catch with graceful degradation:
```typescript
try {
  const result = await prompt(message);
  return JSON.parse(result);
} catch (error) {
  console.error(`[workflow-name] prompt failed: ${error.message}`);
  return { fallback: true, reason: error.message };
}
```

### Circuit Breaker for LLM Calls
Import from `workflows/circuit-breaker.ts`. Wraps prompt calls with automatic retry (3x) and circuit-open on persistent failure:
```typescript
import { withCircuitBreaker } from './circuit-breaker.js';
const safePrompt = withCircuitBreaker(prompt, { maxFailures: 3, resetTimeout: 30000 });
```

### Fake Timers for Async Tests
Use `vi.useFakeTimers()` to eliminate real delays in tests:
```typescript
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });
```

### Failure Injection Testing
Mock external dependencies to verify error paths:
```typescript
vi.spyOn(fs, 'readFile').mockRejectedValue(new Error('ENOENT'));
// Verify workflow handles gracefully, not crashes
```

## 4. Getting Started

1. **Check system health**: `./scripts/system-health.sh`
2. **Run all tests**: `npx vitest run` (expect 95+ files, 1750+ tests passing)
3. **Create a new workflow**: `./scripts/scaffold-workflow.sh <name>`
4. **Before committing**: `./scripts/test-gate.sh`
5. **Check quality**: `./scripts/workflow-quality-score.sh`

## 5. Quality Standards

Each workflow is scored on 5 criteria (100 points max):

| Criterion | Points | Requirement |
|-----------|--------|-------------|
| Has tests | 25 | Corresponding `.test.ts` file exists |
| Error handling | 25 | At least one `catch` block |
| JSDoc | 20 | Module-level `/** */` documentation |
| Under 200 lines | 15 | File length ≤ 200 lines |
| No TODOs | 15 | Zero `TODO`/`FIXME`/`HACK` comments |

**Target**: All workflows should score ≥ 60/100. New workflows created via scaffold start at 85+.

## 6. Quick Reference

- **Test command**: `npx vitest run`
- **Single file test**: `npx vitest run tests/<file>.test.ts`
- **Integration tests**: `npx vitest run tests/integration/`
- **Failure injection tests**: `npx vitest run tests/failure-injection.test.ts`
- **TypeScript check**: `npx tsc --noEmit`
