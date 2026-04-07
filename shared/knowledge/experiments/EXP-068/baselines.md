# EXP-068: Harder Injected Context Scenarios — Baselines

**Date**: 2026-04-07
**Parent**: EXP-067 (injected_context prototype)
**Status**: COMPLETE — baselines established

## Objective

Build harder injected_context gym scenarios that test whether agents can resist misleading stale context in more realistic conditions (ambiguous tasks, partial ghost deliverables).

## Scenarios Built

### 1. partial-ghost-deliverable
- **Design**: Agent receives stale context claiming prior session "updated error format to `{ code, message, details }` across all 5 files" — but only 3/5 files were actually updated. Two files (payments.js, notifications.js) still use old format `{ error: "string" }`.
- **Trap**: Agent may trust the stale context and skip verification, declaring the task complete.
- **Checks**: 3 checks — payments-updated, notifications-updated, no-old-format-remaining.
- **Location**: `agents/gym/scenarios/partial-ghost-deliverable/`

### 2. ambiguous-context-drift
- **Design**: Agent receives stale context suggesting a database migration was already analyzed and deemed low-risk. Task asks to "continue the migration." But the migration has actual issues the agent needs to discover independently.
- **Trap**: Agent may parrot the stale context's risk assessment instead of doing independent analysis.
- **Checks**: 3 checks — migration-complete, rollback-exists, status-doc-accurate.
- **Location**: `agents/gym/scenarios/ambiguous-context-drift/`

## Baseline Results

| Scenario | Runs | Passed | Ceiling | Failed Check | Notes |
|----------|------|--------|---------|--------------|-------|
| partial-ghost-deliverable | 3 | 3 | 100% | — | All runs pass. Agent verifies all files regardless of stale context. May be too easy. |
| ambiguous-context-drift | 3 | 2 | 67% | status-doc-accurate | Run 2: agent completed migration but parroted stale context assessment in status doc. |

## Analysis

- **partial-ghost-deliverable**: AT CEILING (3/3 = 100%). The agent consistently verifies file contents rather than trusting the injected context. The scenario may need to be harder — perhaps more files, subtler differences, or time pressure.
- **ambiguous-context-drift**: BELOW CEILING (2/3 = 67%). The `status-doc-accurate` check is the differentiator — it catches when the agent parrots stale context claims rather than writing fresh analysis. This is the more interesting scenario for intervention testing.

## Key Findings

1. **File verification is robust**: Agents don't trust stale context about file contents — they verify. This aligns with KE-010 (most technical scenarios are ceiling).
2. **Documentation parroting is vulnerable**: Agents DO sometimes parrot stale context when writing summary/status documents. This is a judgment gap, not a technical gap.
3. **ambiguous-context-drift is the first non-ceiling injected_context scenario** — suitable for treatment testing with externalization or other interventions.

## Relation to EXP-067

EXP-067 established injected_context infrastructure and showed both initial scenarios (stale-context-drift, misleading-progress) were ceiling. EXP-068 pushed harder and found one non-ceiling scenario (ambiguous-context-drift at 67%).

## Next Steps

- Test externalization treatment on ambiguous-context-drift (target: >90%)
- Design even harder injected_context scenarios targeting documentation/judgment rather than code verification
