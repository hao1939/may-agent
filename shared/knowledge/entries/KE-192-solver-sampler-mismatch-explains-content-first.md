# KE-192: Solver-Sampler Mismatch Explains Why Content-First Guards Outperform Process Guards

**Date**: 2026-04-16
**Source**: DD-769 (Andric 2026, arXiv 2604.11840) × KE-191 (EXP-165/166/167)
**Confidence**: Medium-High (theoretical synthesis backed by strong empirical pattern)
**Connects**: KE-191, KE-186, KE-007, H-161, DD-769

## Finding

DD-769's solver-sampler mismatch provides a mechanistic explanation for why content-first (F1) guards dramatically outperform process-first (F2) guards in our system.

**The mapping:**
- **Process guards** = solver mode. Forced verification steps, checklists, and structural enforcement push agents to *optimize for compliance* — satisfying the guard's requirements becomes the objective. This collapses behavioral diversity and crowds out the flexible reasoning needed to recognize novel failure patterns.
- **Content guards** = sampler mode. Expert analysis injection provides information without constraining the reasoning path. Agents retain full behavioral flexibility to *simulate* appropriate responses to the specific situation.

## Why This Matters

DD-769 shows that in negotiation, reasoning-enhanced models achieve 45/45 authority decisions (optimal play) but 0/45 compromises (real-world behavior). Our parallel: process guards achieve high structural compliance but 0% recognition of subtle issues like contradictory requirements or misleading tests (EXP-167 baselines).

The mechanism is the same: **optimization toward a measurable objective destroys the soft judgment needed for recognition tasks.**

- In DD-769: optimizing for negotiation payoff destroys compromise dynamics
- In our system: optimizing for process compliance destroys recognition of when the process itself is wrong

## Three Implications

### 1. Content-first is not just "better" — it's categorically correct for recognition tasks

Recognition requires sampling mode: exploring interpretations, noticing anomalies, weighing competing framings. Process guards force solver mode, which is actively harmful for these tasks. This explains KE-191's +100pp effects — it's not that content helps a little more than process, it's that they operate on fundamentally different cognitive axes.

### 2. Process guards should be reserved for execution tasks

DD-769's bounded-reflection intervention recovers compromise by constraining reasoning depth. Analogously, process guards (checklists, forced steps) are appropriate when the task IS optimization — executing a known plan, following a specification, applying a known fix. The failure taxonomy split: use content guards for **recognition** tasks (Ch2 failures), process guards for **execution** tasks.

### 3. Reasoning mode selection is a guard design parameter

This suggests a new hypothesis: guard effectiveness depends on matching the cognitive mode (solver vs sampler) to the task type. We should consider whether guards can explicitly modulate reasoning mode — e.g., "before checking your work, consider three alternative interpretations of this requirement" (sampler prompt) vs "verify each requirement is met" (solver prompt).

## New Hypothesis

**H-166 (proposed)**: Guard effectiveness follows a task-mode alignment curve: content guards dominate for recognition/judgment tasks (sampler mode), process guards dominate for execution/compliance tasks (solver mode), and misalignment causes active harm (not just reduced benefit). Testable by comparing F1 vs F2 on execution-heavy scenarios where the agent already knows what to do.

## Connection to Ch2 Failure Taxonomy

The solver-sampler mismatch suggests Ch2 failures partition into:
- **Sampler failures** (recognition bottleneck): agent doesn't see the problem → content injection fixes
- **Solver failures** (execution bottleneck): agent sees the problem but can't solve it → process/structural fixes
- **Mode-mismatch failures** (our guards cause the problem): process guard applied to recognition task, or content guard applied to execution task → guard redesign fixes

This third category — iatrogenic failures from mode-mismatched guards — may explain why KE-007 found only 5/56 behavioral interventions promoted. Most interventions likely imposed solver mode on sampler tasks.

## Limitation

This is theoretical synthesis. The direct mapping (process=solver, content=sampler) is an analogy, not a proven equivalence. DD-769 studied multi-agent negotiation; our domain is single-agent software engineering. The cognitive mechanisms may differ even if the surface pattern matches.
