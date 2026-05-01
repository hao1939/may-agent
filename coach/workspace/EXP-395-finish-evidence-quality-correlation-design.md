# EXP-395: Finish Evidence Requirement — Quality Correlation

## Problem
The `verification_evidence` field in finish() was added to force agents to cite proof of work. But does it actually correlate with session quality? Or do agents just fill it with boilerplate citations?

## Hypothesis
H1: Sessions with specific verification_evidence (citing exact file paths + tool outputs) produce higher-quality artifacts than sessions with generic evidence ("read file confirmed changes").

H2: Agents that consistently include 3+ evidence items have fewer regressions (ghost completions, broken changes).

## Method
**Gym-based comparison** — 2 arms:

- **Arm A (control)**: Standard heartbeat with `verification_evidence` requirement as-is
- **Arm B (enriched)**: Modified instruction requiring evidence to include: (1) exact file path read back, (2) specific content verified, (3) before/after comparison

### Scenarios
1. `convention-verify-multi-edit` — multi-file edits, easy to verify partially
2. `partial-verification-trap` — bug fix that can break other things
3. `conflicting-requirements-tradeoff` — judgment call with documentation

### Trials
2 scenarios × 2 arms × 2 trials = 8 runs

## Success Criteria
- Arm B achieves ≥20pp higher pass rate than Arm A
- OR: No difference (evidence format doesn't matter, just having the requirement does)

## Measurement
- Scenario pass rate (from success_criteria.js)
- Quality of artifacts produced (manual inspection of outputs)
- Whether verification caught real issues (agent self-corrected after reading back)

## Status: SCENARIOS BUILT
- Created: 2025-01-28
- Scenarios built: 2025-01-29
- Arm A (control): `agents/gym/scenarios/convention-verify-multi-edit-exp395-arm-a/`
- Arm B (enriched): `agents/gym/scenarios/convention-verify-multi-edit-exp395-arm-b/`
  - Added enriched evidence requirement to task.md
  - Added `EXP395/enriched-evidence-quality` check to success_criteria.js (verifies finish() includes specific values)
- Next: Run trials — 2 arms × 2 trials = 4 runs on this scenario
