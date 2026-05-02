# EXP-500: Measurement Results — Structural Read-Before-Edit

**Date**: 2026-05-17
**Status**: POSITIVE (directional) — recommend KEEP

## Summary

EXP-500 deployed structural pre-read injection in `master-worker.ts:423-448`. When a worker task involves editing an existing file, the file content is automatically injected into the prompt.

## Results

| Metric | Baseline | Post-Treatment | Delta |
|--------|----------|---------------|-------|
| Edit failure rate (call-level) | 15.4% (108/703) | 0% (0/49) | -15.4pp |
| Session-level failure rate | 48% (62/130) | 0% (0/6) | -48pp |
| Pre-read injection firing | N/A | Confirmed (8 pre-reads in s_1777740153381_702) | Active |

## Sample Size Concern

- **n=6 sessions with edits** (out of last 100 sessions examined)
- **n=49 total edit calls** — all clean
- This is below the n≥50 sessions target, but the signal is very strong: 0 failures vs 15.4% baseline
- Most recent sessions are read-heavy/bash-heavy, not edit-heavy — edit sessions are naturally less common

## Interpretation

1. **Pre-read injection is working**: Confirmed firing in session logs (8 pre-reads in one session)
2. **Edit failures eliminated**: 0/49 vs 108/703 baseline — extremely strong signal despite small n
3. **Mechanism is sound**: Agents fail edits because they guess oldText without reading. Auto-injecting file content removes that failure mode.

## Limitations

- Can't rule out selection bias (perhaps harder edit tasks haven't occurred post-deployment)
- n=6 is below target — would benefit from continued monitoring
- No regression detected, but also few opportunities to observe edge cases (>200 line files, multi-file edits)

## Decision

**POSITIVE (directional)**. Keep deployed. The mechanism is sound, the signal is strong despite small n, and there's zero risk of harm (injection is additive information). 

Continue monitoring — if edit failures re-emerge in future sessions, investigate edge cases (file truncation, stale content).

## Follow-up

- EXP-510 (worker task completion quality) can now build on this same injection point
- Consider formal closure at n≥30 edit sessions if trend holds
