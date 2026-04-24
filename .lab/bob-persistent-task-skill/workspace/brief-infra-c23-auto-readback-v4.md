# Brief v4: C2.3 Verify-After-Edit — Binary Wiring (Final)

**From**: Bob (research)
**To**: tech-lead (implementation)
**Date**: 2026-04-08
**Priority**: P1 — highest priority unbuilt infra mechanism
**Type**: Final implementation brief — single-track (binary wiring)
**Supersedes**: v3 (v3 proposed dual mechanisms; tech-lead review correctly identified Mechanism A as unviable)

## v3 → v4 Changes

**v3 proposed two mechanisms**: (A) active-nudge real-time loop, (B) binary wiring.

**Tech-lead review finding**: Mechanism A is architecturally impossible because:
1. Active-nudge runs on 5-minute cron cycles, not continuously
2. Nudge delivery is via `nudge-active.md` files picked up at the **start of the NEXT session** (heartbeat-context injection), not during the running session
3. So it's post-hoc feedback — functionally identical to convention-check.ts, which already handles C1.3 detection

**v4 conclusion**: Drop Mechanism A entirely. Go straight to Mechanism B. The existing convention-check.ts C1.3 detection (62.3% pass rate) IS the soft enforcement layer — it already exists and works. The only way to get enforcement above ~62% is a hard gate at finish-time, which requires binary wiring.

---

## Problem

C2.3 (verify-after-edit) has **0% behavioral fix rate** from text/skill interventions:

| Experiment | Method | C2.3 Rate | Notes |
|------------|--------|-----------|-------|
| EXP-020 | verify-after-edit skill | 0% | Text rule = 0% (KE-002) |
| EXP-055/b | Verification gate (workflow) | 100% | But caused regressions elsewhere |
| EXP-056 | Baseline at 7min | 0% | Not a budget gap |
| Post-edit-readback skill | Skill injection | 12.5% | Not promotable |
| Production (coder) | convention-check + coaching | 62.3% C1.3 | Prompting ceiling reached |
| EXP-093 | Few-shot verify-after-edit | -20pp | Made C2.3 WORSE |

Coach conclusion: **"C2.3 requires framework-level enforcement. All text/skill/gate approaches exhausted."**

**Current soft enforcement** (already deployed): convention-check.ts detects C1.3 violations post-session → coaching feedback loop → 62.3% pass rate. This is the ceiling for non-structural interventions.

---

## Architecture Constraints

### What we control — and how it's loaded

| Layer | Files | Loading | Modifiable at runtime? |
|-------|-------|---------|----------------------|
| **Handlers** | `agents/may/handlers/*.ts` | Hot-reloaded by binary on each cron tick | ✅ Yes |
| **Workflows** | `agents/*/workflows/*.ts` | Loaded at workflow execution time | ✅ Yes |
| **Agent context** | `agents/*/context.md`, skills, DOMAIN.md | Loaded at session start | ✅ Yes |
| **src/lib/ modules** | `src/lib/*.ts` | **Compiled into binary** | ❌ Requires binary rebuild |
| **Framework core** | `manager.ts`, tool handlers | **Compiled into binary** | ❌ Requires binary rebuild |

**Key fact**: `finish-guard.ts` is in `src/lib/` (binary-compiled). `convention-check.ts` is in `agents/may/handlers/` (hot-reloadable). This explains why convention-check works but finish-guard doesn't — different deployment layers.

### What we DON'T control

- `edit()` / `write()` / `read()` / `finish()` tool implementations (Claude Code framework)
- The binary's internal tool dispatch pipeline
- Session lifecycle hooks (pre-finish, post-tool)

---

## Implementation: Wire finish-guard.ts into Binary

### What Already Exists

`src/lib/finish-guard.ts` already contains the complete implementation:

**Gate 2 — C2.3 Verify-After-Edit:**
- `validateVerifyAfterEdit()` function with full detection logic
- ToolCall interface with session transcript parsing
- Exempt patterns (matches convention-check.ts exempt list)
- edit() diff-preview detection (successful edits are self-verifying)
- bash verification heuristics (cat, grep)
- Error message with specific file paths and fix instructions

**Gate 1 — Ghost Deliverable Guard:**
- `enforceFinishDeliverables()` — also implemented, also unwired

Both gates are ready. The only missing piece is wiring them into the finish() handler.

### Wiring Steps

Per the original commit message (`0f6712c1`), this is "2-line wiring":

```typescript
// In manager.ts (wherever finish() tool calls are processed):

// 1. Import the validators
import { enforceFinishDeliverables, validateVerifyAfterEdit } from '../finish-guard.js';

// 2. Call them before accepting the finish result
const deliverableResult = enforceFinishDeliverables(finishArgs.deliverables);
if (!deliverableResult.valid) {
  return toolError(deliverableResult.error);
}

const verifyResult = validateVerifyAfterEdit(sessionToolCalls, finishArgs.status);
if (!verifyResult.valid) {
  return toolError(verifyResult.error);
}
```

### Prerequisites to Validate

1. **Find the exact wiring point**: In `manager.ts`, locate where `finish()` tool calls are dispatched
2. **Transcript access**: Confirm `sessionToolCalls` (array of tool calls) is available at the finish handler level. `validateVerifyAfterEdit` needs the session's tool call history.
3. **Error handling**: When a gate rejects, the error message should tell the agent exactly what to do (e.g., "read(path/to/file.ts) to verify your edit before calling finish()")

### Rebuild Coordination

1. **Tech-lead**: Validates the wiring code (confirms it's correct TypeScript, tests locally if possible)
2. **Tech-lead**: Commits the change to a branch
3. **Hao**: Reviews and triggers binary rebuild (last rebuild: 2026-03-31, commit `dc7595b`)
4. **Post-rebuild validation**: Run 5 gym scenarios that test C1.3/C2.3 compliance to confirm guards are active

---

## Expected Impact

| Metric | Current | After Wiring | Reasoning |
|--------|---------|--------------|-----------|
| C1.3 verify-writes | 62.3% | ≥95% | Hard gate prevents finishing without verification |
| Ghost deliverables | ~unknown | Near 0% | Gate 1 validates deliverable paths exist |
| Regression risk | — | Low | EXP-055 regression was from WORKFLOW gates (changed agent behavior mid-session). Finish-time gates are different — they block the final step, not intermediate steps. Agent still works normally until it tries to finish. |

---

## Code-vs-Data Assessment

Per `code-vs-data-decisions.md`:

| Question | Answer | Reasoning |
|----------|--------|-----------|
| Permanent and universal? | **YES** | Verifying writes is always correct |
| Environment-dependent? | **NO** | Checks transcript structure, not paths/content |
| About judgment? | **NO** | Mechanical: "did you read after writing?" |
| Tool bug? | **NO** | Process enforcement gap |

**Assessment**: Code enforcement is correct. This guard checks a **structural transcript property** (presence/absence of read() after write()), which is environment-independent. Unlike the reverted C12.1 guards (commit `b12c138`), this doesn't hardcode path patterns or error regexes.

---

## Evidence Base

- Coach experiments: EXP-020, EXP-055/b, EXP-056, EXP-093
- Knowledge entries: KE-002 (text rules = 0%), KE-007 (structural interventions work), KE-056 (constraint hierarchy)
- Dead-code finding: Tech-lead review session `s_1775683120875_234`
- Tech-lead v3 review: Active-nudge delivery architecture analysis (Mechanism A non-viable)
- Binary architecture: `/usr/local/bin/may-agent` ELF binary (~100MB), last rebuilt 2026-03-31
- Convention-check precedent: C1.3 detection already deployed (62.3% soft enforcement ceiling)
- Reverted guards: C12.1 guards reverted (commit `b12c138`) — environment-dependent. This proposal is environment-independent.
- finish-guard.ts commit: `0f6712c1` — "Ready for pi-agent-core integration (2-line wiring)"
