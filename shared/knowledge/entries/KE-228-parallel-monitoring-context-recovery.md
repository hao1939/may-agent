# KE-228: Heartbeats as cognitive companions — parallel monitoring and negotiated context recovery already exist in our architecture

**Date**: 2026-04-18
**Source**: DD-770 (Cognitive Companion), DD-772 (CONCORD A2A Context Recovery)
**Confidence**: Medium-High
**Connects**: KE-123 (don't stack interventions), KE-105 (verification orchestration), KE-011 (passive knowledge problem)

## Core Finding

Our heartbeat architecture already implements a lightweight version of DD-770's "cognitive companion" pattern — periodic self-monitoring that catches reasoning degradation (stuck states, drift). DD-772's negotiated context recovery maps to our auto-matched knowledge injection. The gap: we lack DD-770's *selective activation* (monitoring intensity scales with task difficulty) and DD-772's *structured gap detection* (agents don't know what they're missing).

## Evidence

- DD-770: Parallel LLM companion reduces loop repetition 52-62% but adds ~11% overhead. Probe-based companion (hidden-state classifier) achieves AUROC 0.840 with zero overhead. Key: task-type dependent — helps on open-ended tasks, neutral/negative on structured ones.
- DD-772 (CONCORD): Three-phase context recovery achieves 91.4% gap recall. Core pattern: gap detection → targeted query → relationship-governed disclosure → integration. Transforms missing context from a hallucination risk into a coordination problem.
- Our system: Heartbeats run on fixed ~30min schedule regardless of task difficulty. Knowledge injection uses keyword matching (auto-matched), not gap detection. FM-3.3 verification collapse rate is 20.3% (EXP-099) — exactly the degradation DD-770 targets.

## Mechanism / Why

Reasoning degradation is detectable before it manifests in output (DD-770's hidden-state probes). Our heartbeat already serves as a "companion check-in" but operates on a fixed schedule rather than adapting to degradation signals. Similarly, our knowledge injection pushes potentially-relevant context rather than pulling based on detected gaps (DD-772). The difference between push and pull is the difference between overwhelming agents with passive knowledge (KE-011) and giving them exactly what they need.

## Implications

### 1. Adaptive heartbeat frequency could reduce FM-3.3
If heartbeats triggered more frequently during complex/open-ended tasks (where degradation is likely) and less during structured tasks, we'd get DD-770's selective monitoring benefit. Current fixed schedule means we check in too late for hard tasks and too often for easy ones.

### 2. Gap-aware knowledge retrieval beats keyword matching
Instead of auto-matching knowledge by keywords in the task description, agents could declare what they don't know (explicit gaps), and the retrieval system could target those gaps. This inverts the current push model into DD-772's pull model.

### 3. Don't add a separate monitoring agent — use heartbeat as the companion
DD-770's LLM companion adds 11% overhead as a separate process. Our heartbeat already interrupts work for self-assessment. The insight is to make heartbeats *smarter* (gap detection, degradation checks) rather than adding another monitoring layer. This aligns with KE-123's "don't stack interventions."

## Actionable

- **Experiment idea**: Vary heartbeat frequency by task type — shorter intervals for open-ended research, longer for structured execution. Measure FM-3.3 rate difference.
- **Knowledge retrieval**: Prototype gap-detection step at heartbeat start — "what am I uncertain about?" → targeted knowledge pull, rather than blanket auto-match injection.
- **Guard integration**: Heartbeat already has the right shape for DD-770's companion. Add a "reasoning health check" step (am I looping? drifting? stuck?) as content within existing heartbeat structure (per KE-008: don't restructure, add content).

## Open Questions

- Can we detect reasoning degradation from text output alone (like DD-770's LLM companion) or do we need hidden-state access (which we don't have for API-based models)?
- How much of our FM-3.3 rate is due to the fixed-schedule heartbeat missing degradation that adaptive scheduling would catch?
- Would explicit gap declaration create overhead that negates the retrieval benefit?
