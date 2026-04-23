# QA Heartbeat — Unreviewed Findings (2026-04-23)

## Context
Heartbeat run had no pending events/projects. I attempted standard verification steps against latest changes in the `/app/agents` repo.

## Findings

### 1) Environment / tooling: cannot run mandatory tsc/vitest commands (CRITICAL environment issue)
**Evidence**
- Running from `/app`: `./node_modules/.bin/tsc --noEmit` fails because `.bin` directory does not exist.
- `node_modules` at repo root only contains `.vite` (no installed toolchain).
- In `/app/agents`: `./node_modules/.bin/tsc --noEmit` also fails; `agents/node_modules` exists but contains only `.vite` and `.vite-temp` (no `.bin`).

This prevents independent verification via `tsc` and `vitest` per QA SOP.

### 2) Latest change is a design doc only (no code to compile/test)
**Commit inspected**: `ca473c3c2 design: project lifecycle - continuous execution, escalation routing, immediate resume`
**File**: `agents/shared/may-agent-docs/design/project-lifecycle-continuous.md`

I read the doc (first ~200 lines). It is marked **Status: Proposal** and outlines changes to handler parallelism, escalation routing, and emitting `project.resumed`.

**QA note**: Since this is a proposal doc, there’s no code-level behavior to verify. However, it proposes concrete changes (files/LOC). If/when implemented, it should come with tests (especially around event subscription and preventing session flooding).

### 3) Potential runtime issue: may-agent-bin appears broken in this environment (IMPORTANT environment issue)
**Evidence**
- `cd agents && ./may-agent-bin --help` outputs: `Agent "may" is not registered` and then attempts to start `may.ts` and fails immediately.

This may be an environment configuration problem, but it blocks exercising workflows locally.

## Suggested next steps
1. Restore/install toolchain so the repo provides `tsc` and `vitest` executables (either via package manager install step or checked-in tool runner). Once available, rerun:
   - `./node_modules/.bin/tsc --noEmit`
   - `./node_modules/.bin/vitest --run`
2. Investigate why `may-agent-bin` reports `Agent "may" is not registered` and why `may.ts` fails immediately.
3. When the proposal is implemented, ensure:
   - Parallel project execution has inflight protections + tests for avoiding duplicate launches.
   - New event subscriptions (`escalation.created`, `project.resumed`) are covered by tests.
