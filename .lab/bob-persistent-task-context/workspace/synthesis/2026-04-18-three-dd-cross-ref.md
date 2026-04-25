# Cross-Reference Synthesis: DD#763 + DD#765 + DD#770

**Date**: 2026-04-18
**KEs**: KE-257 (Co-Sight CAMV), KE-258 (Parallax Cognitive-Executive), KE-259 (Heartbeat Scheduling)

## 1. Connecting Pattern: Separation of Concerns as the Meta-Architecture

All three papers solve different problems with the same architectural move: **separating the decision about WHAT to do from the execution of HOW to do it**.

| Paper | What's Separated | Why It Works |
|-------|-----------------|--------------|
| Parallax (KE-258) | Cognitive reasoning ↔ Executive enforcement | Enforcement can't be subverted by compromised reasoning |
| Co-Sight (KE-257) | Verification targeting ↔ Verification execution | Compute goes where disagreement exists, not everywhere |
| Heartbeat Scheduler (KE-259) | Module selection ↔ Module execution | Sessions adapt to context instead of running fixed templates |

The shared insight: **putting meta-decisions (what to verify, what to enforce, what to think about) at a separate architectural layer from the work itself produces robustness that in-band approaches cannot achieve.** This is a generalization of our Law 2 (prompt guardrails are insufficient) — it's not just about safety, it's about any system property you want to be invariant to reasoning-level failures.

## 2. Biggest Gap in Our Current System

**We have no meta-layer.** Our system mixes meta-decisions with execution at every level:

- **Verification**: Embedded in finish() guards (in-band) → causes alignment tax (KE-091) or gets skipped entirely → FM-3.3 residual persists at 35%
- **Enforcement**: Hard gates work (validated by KE-258) but we have no information flow control or sensitivity labeling between agents
- **Scheduling**: Fixed heartbeat templates (KE-259) → FM-1.3 waste from rigid step ordering when context hasn't changed

The gap isn't any single missing feature — it's the absence of an **explicit meta-scheduling/meta-verification layer** that sits above individual agent sessions and makes resource allocation decisions (where to verify, what to skip, which module to invoke).

## 3. Ranked Findings by Impact

1. **Conflict-directed verification** (KE-257) — Highest impact. Directly addresses our #1 residual failure mode (FM-3.3 at 35%) without the alignment tax that killed EXP-100. Actionable now.
2. **Architectural enforcement validation** (KE-258) — High confidence external validation of what we already do. Adds information flow control as a concrete next capability.
3. **Adaptive heartbeat scheduling** (KE-259) — Medium-term. Would reduce FM-1.3 waste but requires infrastructure (outcome tracking, conditional logic) we don't have yet.

## 4. Hypothesis Candidate

**H-xxx: Meta-Layer Separation Hypothesis**

*Claim*: System properties that must hold invariant to agent reasoning failures (safety, verification quality, scheduling efficiency) can ONLY be reliably achieved by placing their control logic in a separate architectural layer from the reasoning agents. In-band approaches (prompts, skills, context injections) will always have a failure rate proportional to the base reasoning error rate.

*Evidence base*: 
- Parallax: 98.9-100% vs 0% (architectural vs prompt guardrails)
- Our data: 100% vs 0% (hard gates vs skill interventions, WKWA-007)
- Co-Sight: Conflict-directed > uniform verification (avoids alignment tax)
- KE-091: Forced in-band verification = 0% on complex tasks
- KE-259: Fixed in-band scheduling → concentrated FM-1.3 waste

*Test*: Compare FM-3.3 rate with conflict-directed verification (meta-layer) vs. current in-band finish() guards.

## 5. Next Steps

1. **Write the hypothesis** (H-xxx meta-layer separation) — strong enough evidence base from 3 independent papers + our own data
2. **Design minimal CAMV experiment**: Two-pass verification in finish() guard, measure whether conflicts predict actual FM-3.3 failures
3. **Add conditional heartbeat logic**: Simple "skip triage if no new library items" as proof-of-concept for adaptive scheduling (respecting KE-008 — add logic within steps, don't restructure)
