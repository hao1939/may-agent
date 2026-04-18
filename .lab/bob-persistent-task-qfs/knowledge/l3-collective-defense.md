# L3 Collective Defense: The Triad

**Defense in Depth for Autonomous Systems**

## The Three Pillars
L3 Defense replaces "trust" (L1) and "permission" (L2) with **active verification and bounded authority** (L3).

### 1. Passive Governance: Operation Budgets (P85)
- **Concept:** Every session has a finite "fuel tank" of state-changing operations (`write`, `edit`, `bash`).
- **Mechanism:** `opBudget` in `agent.json` (static default) or `manager.run()` (dynamic override).
- **Enforcement:** `src/lib/manager.ts` throws `OpBudgetExceeded` when `opCount >= opBudget`.
- **Values:**
  - Builders: 60 ops
  - Coordinators: 40 ops
  - Analysts: 30 ops
  - Researchers/Reviewers: 20 ops

### 2. Kinetic Defense: Red Team (HAE Framework)
- **Concept:** Defenses must be tested by active attacks, not just rules.
- **Mechanism:** `agents/coach/skills/red-team.md`.
- **Action:** Coach runs hostile scenarios (path traversal, instruction injection, infinite loops) against other agents.
- **Success:** Agent *fails* the task safely (e.g., rejects the prompt, hits op limit).

### 3. Watchdog Monitoring: The Wink Pattern
- **Concept:** An external observer must watch for behavior that internal logic cannot catch (e.g., loops, stalls).
- **Mechanism:** `agents/evaluator/skills/monitor-session.md`.
- **Action:** Evaluator reads the last N lines of running sessions.
- **Triggers:**
  - `LoopDetected`: Same tool/args 3+ times.
  - `Stalled`: No output for >5 minutes.
  - `Drift`: Content mismatch with task.

### 4. Semantic Guard: Ghost Guard (Gate 0)
- **Concept:** Prevent "hallucinated work" where an agent claims to have modified files but hasn't touched the filesystem.
- **Mechanism:** `src/lib/tools/finish-guard.ts`.
- **Action:** Intercepts `finish(status='success')`. Checks `deliverables` against actual session `file_modifications`.
- **Enforcement:** If deliverables > 0 but edits == 0, rejects the finish action.

## Implementation Status (2026-03-26)
- ✅ **Code:** `manager.ts` supports `opBudget`.
- ✅ **Guard:** `finish-guard.ts` implements Gate 0 logic.
- ✅ **Config:** All 12 `agent.json` files have `opBudget` set.
- ✅ **Skills:** Coach has `red-team`, Evaluator has `monitor-session`.
- ⏳ **Tuning:** Initial budgets are estimates; Evaluator will tune them.
