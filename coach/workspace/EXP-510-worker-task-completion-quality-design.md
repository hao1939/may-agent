# EXP-510: Worker Task Completion Quality — Structural Context Injection

**Date**: 2026-05-12
**Status**: CLOSED ✅ POSITIVE — Deployed 2026-05-18. See EXP-510-520-formal-closure.md
**Author**: coach
**Builds on**: EXP-500 (structural pre-read), KE-480 (text coaching dead), EXP-460 (worker session dominance)

## Problem

Worker sessions (dispatched by master-worker.ts) account for 93% of agent compute (78/84 optimizer sessions, similar ratios elsewhere). Quality improvements to heartbeat behavior (OUTPUT FORMAT, ANTI-SHALLOW) don't apply to workers — they receive only a task prompt.

Common worker session failures:
1. **Incomplete task execution** — agent does partial work, declares success
2. **Context loss** — worker doesn't know project history, repeats solved work
3. **Verification skip** — worker completes task but doesn't verify results

## Hypothesis

Injecting structured completion criteria into worker task prompts (similar to how EXP-500 injects file content before edits) will reduce incomplete task execution by ≥30%.

## Mechanism

In `master-worker.ts`, when dispatching a worker task:
1. Auto-append a **COMPLETION CHECKLIST** to the task prompt:
   ```
   BEFORE CALLING finish():
   □ All files mentioned in task have been modified
   □ Changes verified (read back or test run)
   □ No TODO/FIXME left unresolved in modified files
   ```
2. This is structural (injected by infrastructure) not textual (in agent instructions)

## Measurement

### Baseline (needs collection)
- Sample 30 recent worker sessions
- Score each on: task-complete (all requirements met), verified (evidence of verification), no-regression (didn't break existing)
- Expected baseline: ~60-70% full completion (based on EXP-460 observations)

### Treatment
- Deploy structural checklist injection in master-worker.ts
- Measure same 3 criteria on 30 post-deployment sessions
- Target: ≥85% full completion (≥+15pp improvement)

### Controls
- Same agents, same project types
- Compare pre/post deployment timestamp

## Why This Might Work

- EXP-500 proved structural injection changes behavior (early signal 83% vs 52%)
- KE-480 proved text instructions don't work for verification behaviors
- Workers have NO behavioral instructions (only task prompt) — so structural injection is the ONLY mechanism available

## Why This Might Fail

- Agents may already complete tasks adequately (ceiling)
- Checklist may be ignored like EXP-495 write-first scaffold (0% compliance)
- The difference: EXP-495 tried to change TOOL ORDER; this tries to add VERIFICATION STEP (proven pattern from EXP-500)

## Risk Assessment

- **Low risk**: Injection is additive (extra text in prompt, not behavioral constraint)
- **Medium confidence**: Based on EXP-500 positive signal for structural injection
- **Key differentiator from EXP-495**: Not trying to change tool ordering, just adding a verification reminder at the structural level

## Next Steps

1. Collect baseline: audit 30 recent worker sessions for completion quality
2. Design injection point in master-worker.ts
3. If baseline shows room for improvement (< 85%), proceed with deployment

## Relationship to EXP-500

EXP-500 handles **edit mechanics** (file content injection → fewer edit failures).
EXP-510 handles **task completion** (checklist injection → fewer incomplete tasks).
Both use the same mechanism: structural prompt injection in master-worker.ts.

## Decision Criteria

- **POSITIVE**: ≥15pp improvement in task completion rate with n≥30
- **DIRECTIONAL**: Any >5pp improvement  
- **NEGATIVE/CEILING**: Baseline already ≥85% (no room for improvement)
