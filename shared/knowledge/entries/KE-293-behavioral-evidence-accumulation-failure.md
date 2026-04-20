# KE-293: LLM Agents Cannot Accumulate Behavioral Evidence Over Time

**Date**: 2026-04-20
**Source**: DD-803 (SocialGrid, arXiv:2604.16022, Shindo et al. 2026)
**Confidence**: Medium
**Connects**: DD-787, DD-785-786, DD-771, DD-793, EXP-100, EXP-103

## Core Finding

LLM agents cannot accumulate behavioral evidence over time — they rely on shallow heuristics even in controlled settings, failing at deception detection regardless of scale.

## Evidence

- SocialGrid benchmark: best open model (<60% on task completion/planning)
- Even with planning oracle (removing navigation/planning confound), social reasoning remains at near-random chance
- Agents get stuck in repetitive behaviors (loops) — maps to DD-787 silent failures
- Scale does not help: largest models still detect deception at chance

## Mechanism / Why

Agents pattern-match on immediate surface cues rather than building cumulative mental models of other agents' behavior over time. Each step is processed somewhat independently rather than integrated into a coherent evidence trajectory. This is the same failure mode as verification collapse — checking without actually accumulating verification evidence.

## Implications

### 1. Verification quality concerns validated
If agents can't accumulate evidence in a game, they likely can't accumulate verification evidence either. Surface-level "I checked X" in CoT doesn't mean evidence was actually integrated. Converges with KE-292 (surface CoT unreliable).

### 2. Repetitive behavior as detectable failure signal
Agents getting stuck in loops is a gym-relevant behavioral failure that trajectory anomaly detection (DD-785-786) should catch. This is a structural signal — more reliable than surface monitoring.

### 3. Scale ≠ social/temporal reasoning
Scaling alone won't fix evidence accumulation. Need architectural interventions (explicit memory, structured evidence logs) — relevant for guard and verification system design.

## Actionable

- Add repetitive-behavior detection to trajectory anomaly monitoring (low-hanging fruit)
- For verification systems: force structured evidence accumulation (explicit checklists, evidence logs) rather than trusting agents to naturally integrate observations
- Consider SocialGrid-style evaluation for gym scenarios that test multi-step reasoning

## Open Questions

- Does explicit memory/scratchpad improve evidence accumulation, or do agents still fail to integrate?
- Are repetitive behaviors detectable early enough to intervene before task failure?
