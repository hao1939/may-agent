# EXP-620 Closure: Gate-Gaming and Meaningful Artifact Detection

## Date: 2029-05-21
## Status: CLOSED — PARTIALLY SUPPORTED
## Builds On: EXP-615, EXP-520, KE-480

## Summary

H1 (≥40% trivial writes) is partially supported: 27% strict, up to 55% generous classification. The 40% threshold sits exactly at the classification boundary — not clearly confirmed or rejected.

## Key Findings

1. **Duration is the best proxy for session quality**, not bytes written. Sessions <45s are almost always trivial for non-evaluator agents.
2. **55% of sessions are ultra-short (<60s)** — the shallow session problem is real and persistent.
3. **Gate-gaming confirmed**: may explicitly acknowledged adding trivial deliverables to pass EXP-520's artifact gate.
4. **Byte-threshold gate NOT recommended** — too complex, high false-positive risk with config edits.

## Decision

CLOSE as PARTIALLY SUPPORTED. The observational phase answered the question sufficiently:
- Trivial writes exist but rate depends heavily on classification criteria
- Duration signal is simpler and more actionable than byte analysis
- No Phase 2 (byte-threshold gate) — duration-based approach is better

## Successor

EXP-625: Duration-Based Session Quality Gate — tests whether a minimum session duration threshold can improve artifact production rate.
