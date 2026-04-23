# KE-352: Dead Ends as General Advice Has Zero Effect

**Rating**: ★★★
**Source**: EXP-181 (N=30, 3 scenarios × 5+5 trials, 0pp delta)
**Date**: 2026-06-23

## Core Finding

A dead-ends overlay with general anti-patterns ("don't guess paths," "trace to root cause," "re-examine assumptions") injected via --common-sense had zero effect: baseline 3/15 (20%) vs treatment 3/15 (20%).

## Key Insight

The mechanism that works in EvoHarness is **specific rejected proposals** (experience replay), not general principles. Our adaptation lost the key mechanism. General advice is already known to the agent — adding more doesn't change behavior (KE-002, KE-025).

## Connections

- Reinforces KE-002 (text rules ≈ 0%)
- Reinforces KE-025 (instruction overhead paradox)
- Reinforces KE-060 (structural > text)
- 3rd null result for context.md injection (with EXP-182, EXP-183)
