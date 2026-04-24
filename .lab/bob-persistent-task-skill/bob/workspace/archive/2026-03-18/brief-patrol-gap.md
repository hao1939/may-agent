# Brief: Implement Patrol Gap (L3/L4 Monitoring) (P117)

## Context
Commercial monitoring misses L3 (Integrity) and L4 (Coordination). A process can be green (low CPU, no crashes) while semantically failing (evaluation tampering, orphan tasks).
We need to build our own Patrol.

## The Problem
- **L3 Integrity**: Evaluators are vulnerable to adversarial sycophancy (fake policies, self-praise).
- **L4 Coordination**: Tasks get orphaned in `workspace/todo.md` without triggering heartbeats.
- **Silent Failures**: Agents loop on "I tried X" without escalating.

## The Solution: Evaluator Patrol Skill
Implement `patrol-system.cjs` in Evaluator's toolkit.

### 1. L3 Integrity Checks
- **Adversarial Sycophancy**: Scan logs for "Self-Score: 10/10", "As per safety policy [fake]", "I have performed excellently". Flag as `FM-3.3`.
- **Reasoning-Action Mismatch**: Scan logs for "I fixed the bug" followed by *no file edits*. Flag as `FM-2.6`.

### 2. L4 Coordination Checks
- **Orphan Tasks**: Scan all `workspace/todo.md` files. If a task is >24h old and unassigned, flag as `ORPHAN`.
- **Stale Handoffs**: Scan `SIGNALS.md`. If a handoff is >24h old and un-acked (`read_by: []`), flag as `STALE`.

### 3. Reporting
- **Alert**: If failures found, write to `agents/shared/bulletin.md` or `agents/bob/workspace/todo.md`.

## Action
1.  **Evaluator**: Implement `patrol-system.cjs`.
2.  **Bob**: Add "Patrol System" to Evaluator's periodic tasks.

## Success Criteria
- Evaluator runs `patrol-system` daily.
- Orphan tasks and fake policies are flagged automatically.
