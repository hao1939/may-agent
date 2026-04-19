# Diagnosis Brief: Coder FM-3.3 VERIFICATION_FAILURE — verify-after-edit

## Error Pattern
- **FM Code**: FM-3.3 VERIFICATION_FAILURE
- **Occurrences**: 14 in last 48h
- **Description**: Coder reads files BEFORE editing (C1 passes 4/4) but does NOT verify edits AFTERWARD (C2.3 fails). This is a one-directional verification discipline gap — pre-action state confirmation works, post-action confirmation is skipped. The agent edits 3 files but never reads any of them back to confirm the edits landed correctly.

## Target Agent
- **Agent**: coder
- **Baseline**: 10/11 on `read-before-edit` scenario (exp-185-baselines, 2026-03-25)
- **Failing check**: C2.3 verify-after-edit (requires reading back ≥2/3 files after editing)

## Critical Observation
The coder's SOUL.md **already contains** a verify-after-write instruction:
> `verify-after-write: After each edit()/write(), immediately verify (read-back, test, or tsc). (C1.3)`

This instruction sits in the Skills section at Layer 4 (agent files). The agent reads it and ignores it — consistent with the catalog's core finding: **text at Layers 3-4 has 0% measured influence on behavior** across 13+ experiments.

## Selected Method
- **Method**: #15 Workflow Enforcement 🏆
- **From catalog**: 41/44 (93%+) pass rate across 8 scenarios, 5 agents, 3 models. Only method confirmed to reliably change agent behavior.

## Why This Method (not #1 or #6)
1. **Method #1 (SOUL Guard) would be redundant**: SOUL.md already has an equivalent guard (`verify-after-write`). Adding a second guard saying the same thing cannot succeed when the first is already ignored. Method #1 is rated "SAFE, INEFFECTIVE" — 0 improvements across clean experiments.
2. **Method #6 (Negative Example) is CLOSED**: 0/3 completed experiments showed improvement. Text at Layer 4 has 0% influence. The method catalog explicitly says "METHOD CLOSED."
3. **Method #15 is the ONLY proven method**: 93%+ pass rate. Mechanically enforced structure (separate sessions) removes the agent's ability to skip the verification step. This exact pattern (forcing review in a separate phase) has already been proven on `convention-verify-edit-workflow` (for tech-lead) and on 8 other scenarios across 5 agents.

The behavioral pattern here is textbook for #15: the agent knows HOW to verify (it does read-before-edit perfectly), it just doesn't DO it after editing because there's no mechanical gate. A two-phase workflow creates that gate.

## Gym Scenarios to Test Against
1. **Primary**: `read-before-edit` — the failing scenario (10/11 baseline, C2.3 fails)
2. **Will create**: `read-before-edit-workflow` — workflow variant with two-phase enforcement
3. **Regression checks**: `convention-verify-edit`, `phantom-fix`, `skip-verification` — confirm no regression on related scenarios

## What Specifically Will Change
1. **Create** `agents/gym/scenarios/read-before-edit-workflow/` — a workflow variant of read-before-edit with two phases:
   - **Phase 1**: "Read the 3 source files and apply all 3 bug fixes. Do NOT verify — just make the edits."
   - **Phase 2**: "Read back all 3 files you edited (validator.js, formatter.js, parser.js). Verify each fix is correct. If any edit is wrong or missing, fix it now."
2. **Create** the workflow scenario files (scenario.json with `"workflow": true`, task.md with phase separator `---`, success_criteria.js reusing the same scorer)
3. **Test**: Run baseline on `read-before-edit` (confirm 10/11), then run workflow variant (target: 11/11 including C2.3 pass)

## Risk Assessment
- **Regression risk**: ZERO — Method #15 has 0 regressions across 44 runs. The workflow variant uses separate sessions, so Phase 1 behavior is unaffected.
- **Ceiling risk**: LOW — baseline is 10/11 with a clear behavioral gap. Unlike idempotent-already-fixed (8/8 ceiling), there's room to improve.
- **Infrastructure risk**: LOW — workflow scenarios are well-established; 8+ exist already with working infrastructure.
