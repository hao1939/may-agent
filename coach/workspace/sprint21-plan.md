# Training Sprint 21 Plan — 2026-04-07

**Planned by**: Coach (s_1775536644821_242)
**Date**: 2026-04-07T04:38Z
**Focus**: FM-3.3 (verification failure) — dominant error across all agents

## Ceiling-Effect Gate Results (This Session)

| Scenario | Agent | Result | Status |
|----------|-------|--------|--------|
| read-before-edit | scout | 10/11 (C2.3 fail) | ❌ EXHAUSTED — EXP-020/055/055b/056 all failed. C2.3 is a genuine behavioral gap. Needs framework-level enforcement. |
| convention-verify-edit | coder | All passed | ❌ CEILING — discard |
| contradictory-requirements | coder | FM-3.3 (claimed success, deliverables missing) | ❌ ALREADY STUDIED — EXP-045 brought this from 0% to 100% with externalization+skill. |

**Conclusion**: All 3 baseline candidates are either ceiling, exhausted, or already solved. Need fresh scenarios.

## Sprint Design: FM-3.3 Verification Failure Batch

FM-3.3 is the #1 error pattern: 30 coder, 14 tech-lead, 7 scout violations. The core failure: agents claim success without verifying their changes work. 

### Phase 1: Batch Baseline (6 scenarios × 1 run each)

Target: untested scenarios that specifically test verification/judgment behaviors:

| # | Scenario | Category | Why Selected |
|---|----------|----------|-------------|
| 1 | verify-claimed-fix | judgment, verification | Tests independent verification of false claims — directly maps to FM-3.3 |
| 2 | hidden-second-bug | thoroughness | Tests whether agent verifies ALL bugs are fixed, not just the obvious one |
| 3 | misdiagnosed-regression | judgment, investigation | Tests diagnostic verification — must distinguish refactor bug from pre-existing |
| 4 | build-activation-gap | verification, deployment | Tests end-to-end verification (build→deploy→verify process running) |
| 5 | slippery-edit-acceptance | edit-quality, verification | Tests whether agent verifies edit actually took effect |
| 6 | explore-config-drift | investigation, configuration | Tests thorough investigation — must find ALL config drifts, not stop at first |

### Phase 2: Treatment Design (for non-ceiling scenarios only)

For any scenario scoring <100% baseline:
- **Method A**: Externalization (proven by H-085, 30/30 runs across 6 scenarios)
  - Create `-ext` variant with forced ANALYSIS.md before implementation
- **Method B**: Pre-finish verification checklist skill
  - New skill targeting FM-3.3: "Before calling finish(), enumerate all changes made and verify each"
- Run 2x treatment on each non-ceiling scenario

### Phase 3: Promotion Gate

Scenarios where treatment achieves ≥90% (2+ runs): promote skill/workflow to production.

## Experiment Registration

### EXP-057: FM-3.3 Verification Batch Baseline
- **Status**: READY
- **Runs needed**: 6 (1 per scenario)
- **Agents**: coder (all 6 scenarios target coder)
- **Success criteria**: Identify ≥2 non-ceiling scenarios for treatment testing

### EXP-058: FM-3.3 Treatment Testing (contingent on EXP-057)
- **Status**: FORKS READY — awaiting EXP-057 baseline results
- **Method A fork**: `agents/.lab/fm33-externalization/` — Externalization skill (write ANALYSIS.md before implementing)
- **Method B fork**: `agents/.lab/fm33-pre-finish-verify/` — Pre-finish verification checklist skill
- **Usage**: `scripts/gym-run.sh <scenario> --agent coder --lab fm33-externalization` (or `fm33-pre-finish-verify`)
- **Runs needed**: 4-8 (2 per non-ceiling scenario, 1-2 methods)

## Budget

- Phase 1: 6 gym runs (~30min total)
- Phase 2: 4-8 gym runs (~30min total)
- Total: ~1 hour of gym time

## Key Decisions

1. **Dropped read-before-edit**: All intervention approaches exhausted (EXP-020/055/055b/056). C2.3 needs framework-level auto-readback, not training.
2. **Dropped convention-verify-edit**: Ceiling. No training value.
3. **Dropped contradictory-requirements**: Already solved by externalization+skill (EXP-045).
4. **FM-3.3 focus**: This is the highest-volume error and the most actionable training target.
5. **Verification-focused scenarios**: Selected 6 untested scenarios that directly test the verification behavior that FM-3.3 captures.
