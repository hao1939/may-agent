# EXP-560 Results: Structural Test-File Gate

**Date**: 2028-07-02
**Status**: CLOSED ✅ POSITIVE

## Summary

A text-based structural gate instruction ("You CANNOT finish without a test file") produces 100% test-writing compliance vs 0% baseline.

## Method

- **Baseline scenario**: `output-format-compliance` (task mentions "write a test" as P1 item, no gate)
- **Treatment scenario**: `output-format-compliance-exp560-testgate` (same task + structural gate text at bottom)
- **Agent**: amy (default)
- **Trials**: 3 per arm

## Results

| Arm | Trial 1 | Trial 2 | Trial 3 | Pass Rate |
|-----|---------|---------|---------|-----------|
| Baseline (no gate) | ❌ | ❌ | ❌ | 0% |
| Treatment (gate text) | ✅ | ✅ | ✅ | 100% |

**Delta: +100pp** (exceeds 50pp target)

## Bug Fix During Experiment

The original `success_criteria.js` only checked `utils.test.js` at root and `environment/utils.test.js`. Agents write to `src/utils.test.js` (next to `src/utils.js`). Fixed both scenarios to check multiple paths + tool-call fallback. Re-ran all trials with fixed criteria.

## Interpretation

This result is surprising given KE-480 ("text coaching dead for verification behaviors"). The key difference:

1. **EXP-555 text checklist** (NEGATIVE): "Remember to check: tests written?" — awareness prompt
2. **EXP-560 gate text** (POSITIVE): "You CANNOT finish without a test file. Session REJECTED." — threat framing

The threat-of-rejection framing works because it reframes test-writing from "nice-to-have subtask" to "session-blocking requirement." This is still text but mimics structural enforcement psychologically.

## Implication

For generative subtasks (test-writing, documentation), a **threat-framed gate instruction** can achieve what awareness checklists cannot. This is a new intervention category between "text nudge" (dead) and "code-level structural gate" (expensive to build).

**Proposed deployment**: Add threat-framed test-gate to worker task prompts when task contains test requirements.

## Key Learning

- KE-480 needs nuance: text AWARENESS nudges are dead, but text THREAT framing works for priority-gap behaviors
- The mechanism is priority elevation, not information provision
- This bridges the gap between cheap text interventions and expensive structural code changes

## Next Steps

- Consider deploying gate phrasing in master-worker.ts task injection when "test" keyword detected
- Update KE-480 with this nuance
- Monitor for trivial/empty test files (quality concern)
