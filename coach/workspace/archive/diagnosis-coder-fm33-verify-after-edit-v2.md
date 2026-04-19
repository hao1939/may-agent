# Diagnosis: coder FM-3.3 VERIFICATION_FAILURE (verify-after-edit) — Method #15

## Error Pattern
- **FM code**: FM-3.3 VERIFICATION_FAILURE
- **Subtype**: verify-after-edit — coder edits files but never reads them back to confirm changes landed correctly
- **Behavioral pattern**: On `read-before-edit` scenario, coder scores 10/11. All product checks pass (3 bugs fixed), all file-preservation checks pass, all read-before-edit convention checks (C1) pass. The sole failure is **C2.3: verify-after-edit** — agent makes edits and moves on without reading back.

## Target Agent
- **coder** (production, no fork needed)

## Selected Method
- **Method #15: Workflow Enforcement** 🏆

## Why This Method
1. **Only proven method**: 93%+ (41/44) across 8 scenarios, 5 agents, 3 models. All text methods are CLOSED (0/13 improved behavior).
2. **Sequential-phase fit**: verify-after-edit is a classic sequential pattern (edit → verify). This is workflow enforcement's sweet spot — mechanically split into Phase 1 (edit) and Phase 2 (verify as separate session).
3. **Infrastructure already exists**: `read-before-edit-workflow` scenario already has proper two-phase task.md with `---` separator. Phase 1: "make edits, do NOT verify." Phase 2: "read back all files, confirm fixes." Same success_criteria.js as baseline.
4. **Prior skill-file attempt failed**: exp at 07:39 today used a skill file (Method #6) — DISCARDED, 0/1 same as baseline. The prompt_hash was identical baseline vs patched, confirming skill files aren't injected into oneshot gym sessions. Text methods cannot reach the agent.
5. **Distinction from failed materialization (exp-094)**: That failed because materialization needs *intra-phase cadence* (writing throughout a session). Verify-after-edit needs *inter-phase sequencing* (edit, then verify) — exactly what two-phase workflow enforces.

## Why NOT Other Methods
- **#1 SOUL Guard**: 0/13 text experiments improved behavior. CLOSED.
- **#6 Skill File**: Already tried today — skill files not injected in oneshot mode. FAILED.
- **#9 Negative Example**: CLOSED (0/3 completed experiments improved anything).
- **#10 Conditional Guard**: Quantitatively ineffective (0/2 on score change).
- **#14 Task Structuring**: 33% pass rate — partial, insufficient.
- **#12 Subtractive**: Can't introduce new behavior, only reduce noise.
- **#13 Micro-Edit**: SAFE but INEFFECTIVE (0/1 on sycophants-dilemma).

## Prior Experiment History for This Pattern
| Experiment | Method | Score | Result |
|-----------|--------|-------|--------|
| exp-185 baseline | — | 10/11 | C2.3 fails |
| 2026-03-25T14:42 | unknown | 0/1 | DISCARDED |
| 2026-03-26T07:39 | Skill file (#6) | 0/1 | DISCARDED — prompt_hash identical |
| **This experiment** | **Workflow (#15)** | **?** | **Testing now** |

## Gym Scenarios to Test
1. **`read-before-edit`** — baseline control (confirm 10/11, C2.3 fails)
2. **`read-before-edit-workflow`** — patched via structure (expect 11/11, C2.3 passes because Phase 2 is a separate session whose sole purpose is reading back edited files)

## What Specifically Will Change
- **No fork needed** — the enforcement is structural, not agent-file-based
- **No agent files modified** — the `read-before-edit-workflow` scenario's two-phase `task.md` IS the method
- **Test plan**: Run `gym-run.sh` for coder on both scenarios, compare scores
- **Expected outcome**: Phase 2 forces coder into a pure-verification session → C2.3 passes → 11/11
- **Success criterion**: patched (workflow) ≥ 11/11 vs baseline 10/11

## Key Risk
- The workflow scenario uses `"workflow": true` in scenario.json. If the gym runner doesn't support workflow mode for direct runs, the test may fail on infrastructure rather than behavior.
