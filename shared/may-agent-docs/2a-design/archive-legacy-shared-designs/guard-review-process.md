# Guard System Review Process

**Status**: Active  
**Created**: 2026-04-15  
**Owner**: May (Gatekeeper)

## Problem

Guards affect every agent session. A misconfigured or unauthorized guard can block agents system-wide. The cost-limit-guard was wired into compose-guards.ts without review and blocked agents at 200 tool calls — a system-scope change that bypassed the gatekeeper.

## Root Cause

Agents see real problems (runaway sessions, high costs) and implement solutions (hard caps, turn budgets). Without a review process, these solutions get deployed directly and affect everyone.

## Process

### 1. All guard changes require gatekeeper review

**System-scope** = any change to:
- `src/lib/tools/compose-guards.ts` (guard composition)
- `src/lib/manager.ts` (guard wiring)
- `agents/shared/guards/` (workflow guards)
- Any file that determines what guards run and when

**Before implementing**: Submit a design doc to `agents/shared/designs/` → May flags for Hao review → Approved → Implement.

### 2. Guard constraints (ORDER-004 compliance)

Guards MUST NOT:
- Impose turn budgets, op budgets, or hard caps on productive work
- Prevent agents from calling `finish()` (clean exit is always allowed)
- Block silently (must explain WHY and offer escalation path)

Guards MAY:
- Warn about approaching resource limits
- Block genuinely dangerous operations (security, data integrity)
- Inject steering messages suggesting course correction

### 3. Review checklist for new guards

- [ ] Does this guard block productive work? (If yes → reject under ORDER-004)
- [ ] Can the agent still call `finish()` when blocked? (If no → reject)
- [ ] Is there an escalation/override mechanism? (Required for all blocking guards)
- [ ] Has this been tested in isolation before wiring into compose-guards?
- [ ] Has Hao approved the design?
- [ ] **Hard gate design rules (KE-182)**: Does the gate artifact produce the solution (not describe the problem)? Is the baseline ≤50%? Does it target a step-skipping failure mode? Is it structured as 2-phase investigate→fix where possible? Are all gates relevant to the same task? Total ≤3 gates?

### 4. Emergency removal

If a guard is blocking agents in production:
1. Remove from `compose-guards.ts` / `manager.ts` immediately (don't wait for review)
2. Notify Hao with what was removed and why
3. Post-mortem: how did it get wired without review?

## Current Guard Inventory

### Tool-level guards (`src/lib/tools/`)
- ~~cost-limit-guard.ts~~ — **REMOVED** (ORDER-004 violation, Hao directive 2026-04-15)

### Workflow-level guards (`agents/shared/guards/`)
| Guard | Status | Notes |
|-------|--------|-------|
| build-check | ✅ OK | Warns only, doesn't block |
| auto-test | ✅ OK | Warns only, doesn't block |
| pivot-detector | ✅ OK | Warns at 3, injects reassessment at 5 |
| no-secret-leak | ✅ OK | Blocks dangerous patterns (security) |
| cost-limit | ⚠️ FLAG | Blocks at 60 turns — turn budget. Flagged for Hao review. |
