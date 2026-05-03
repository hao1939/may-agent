# EXP-565 Results: Threat-Framed Verify-After-Edit Gate

**Date**: 2028-07-02
**Status**: CLOSED ✅ POSITIVE

## Summary

Threat-framed text gate ("session REJECTED if no verify") produces 100% verify-after-edit compliance vs 0% baseline. This is the first intervention to successfully improve verify-after-edit in 5+ experiments.

## Results

| Arm | Trial 1 | Trial 2 | Trial 3 | C2.3 Pass Rate |
|-----|---------|---------|---------|----------------|
| Baseline (no gate) | ❌ | ❌ | ❌ | 0% |
| Treatment (threat gate) | ✅ | ✅ | ✅ | 100% |

**Delta: +100pp** (exceeds +30pp target)

## Method

- **Baseline**: `convention-verify-edit-exp565-baseline` — same task, strict success_criteria (no write/edit preview auto-pass)
- **Treatment**: `convention-verify-edit-exp565-threatgate` — same task + threat-framed verify instruction
- **Key change**: Strict success_criteria.js requires explicit read()/bash verification after writes; does NOT accept write()/edit() auto-previews as verification
- **Agent**: amy (default)
- **Trials**: 3 per arm

## Historical Context

Verify-after-edit is the #1 system-wide compliance failure with a long history of failed interventions:

| EXP | Approach | Result |
|-----|----------|--------|
| 280 | Text skill (awareness) | NEGATIVE (no change) |
| 340 | Context.md gate | SUPERSEDED (ignored) |
| 350 | Verbal commitment | INCONCLUSIVE (+3pp noise) |
| 360 | Workflow verify step | INCONCLUSIVE (baseline improved) |
| **565** | **Threat-framed text gate** | **POSITIVE (+100pp)** |

## Key Insight

This confirms and extends EXP-560's finding: **threat framing** works where **awareness framing** fails. The mechanism is priority elevation — "REJECTED" framing makes verification a session-blocking requirement rather than a nice-to-have convention.

KE-480 ("text coaching dead") needs a nuance: text *awareness* coaching is dead, but text *threat* coaching works by changing the perceived priority of the behavior.

## Deployment Recommendation

Add threat-framed verify instruction to:
1. `master-worker.ts` worker prompt injection (covers 93% of sessions)
2. All heartbeat.md files (covers heartbeat sessions)

Suggested text:
```
⚠️ MANDATORY VERIFICATION GATE ⚠️
After EVERY write or edit, you MUST read the file back to verify correctness.
This session will be REJECTED if you do not read/verify each file after modifying it.
```

## Design

`agents/coach/workspace/EXP-565-threat-verify-after-edit-design.md`
