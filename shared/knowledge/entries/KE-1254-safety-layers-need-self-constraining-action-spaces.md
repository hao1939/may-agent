# KE-1254: Safety Layers Need Self-Constraining Action Spaces

<ai_context>
summary: "The safety/observability layer (guards, evaluator, triage) operates with unconstrained action spaces — the exact failure mode KE-1235 identifies as the root cause of security, alignment, and reliability failures. The immune system is exempt from the immune system. Applying constrained-action-space principles to the safety layer itself is the structural fix for metabolic dominance (KE-1253)."
triggers: [safety-layer, action-space, constraint, autoimmune, metabolic, self-referential, guard, evaluator]
last_updated: 2026-05-13
source_basis: "Synthesis of KE-1235 (constrained action spaces), KE-1253 (metabolic dominance), KE-1252 (alert fatigue), KE-123 (iatrogenesis)"
</ai_context>

## The Gap

KE-1235 established a principle: **every unnecessary degree of freedom in agent action selection simultaneously increases security surface, conformity drift, and brittleness.** The fix is to constrain action spaces — channel capability through typed, auditable, bounded interfaces.

KE-1253 established a problem: **the safety layer consumes 61% of compute in a self-sustaining loop** — guards fire, evaluator reviews, metrics alert, triage responds, each generating more guard/evaluator/metric events.

These two findings haven't been connected. But the connection is the insight:

**The safety layer operates with completely unconstrained action spaces.**

- Guards can fire on *any* condition, at *any* frequency, with no rate limit or priority
- Evaluator can review *any* session, producing *any* volume of findings
- Triage can spawn *any* response to *any* alert
- Meta-sessions (evaluator reviewing evaluator) have no recursion bound

The productive layer has constraints: structured session types, read-only DB access, workflow primitives, guard rails. The safety layer has none of these. It is the one part of the system that KE-1235's principle hasn't been applied to.

## Why This Matters

The autoimmune analogy in KE-1253 is apt, but the biological immune system actually *does* have constrained action spaces:

- **T-cell exhaustion**: Immune cells that fire too long enter a quiescent state (rate limiting)
- **Regulatory T-cells**: Dedicated cells whose job is suppressing other immune cells (meta-constraint)
- **Thymic selection**: Immune cells that react to self-tissue are killed during development (tolerance)
- **Complement decay**: Inflammatory signals have built-in half-lives (TTL on alerts)

Our safety layer has none of these. It's an immune system without downregulation — which is literally what autoimmune disease is.

## The Structural Fix

Apply KE-1235's constrained-action-space principle to the safety layer itself:

1. **Guard fire budget**: Each guard type gets N fires per hour. After that, it enters "exhaustion" — logs but doesn't emit events. This is T-cell exhaustion.

2. **Evaluator recursion depth = 1**: Evaluator sessions are tagged `meta: true`. Sessions with `meta: true` are never evaluated. This breaks the recursive loop without removing evaluation. This is thymic selection — the immune system learns not to attack itself.

3. **Alert TTL**: A guard.triggered event that isn't acted on within M minutes expires. It doesn't accumulate. This is complement decay.

4. **Safety budget cap**: Total safety-layer sessions per hour ≤ K, enforced by the orchestrator. If the cap is hit, lowest-priority safety tasks are dropped. This is the metabolic budget KE-1253 calls for, but implemented as an action-space constraint rather than a policy.

## The Deeper Point

KE-1235 argued that constrained action spaces unify security, alignment, and reliability. KE-1253 showed that the safety layer has become the system's biggest reliability problem. The synthesis: **a safety layer with unconstrained action spaces will eventually become the primary threat it was designed to prevent.** The fix isn't better safety rules — it's applying the same constraint principle to safety that safety applies to everything else.

Self-constraining systems are more robust than self-monitoring systems. An immune system that can't overfire is better than an immune system that monitors itself for overfiring (because the monitor is itself part of the immune system, creating the loop KE-1253 documents).
