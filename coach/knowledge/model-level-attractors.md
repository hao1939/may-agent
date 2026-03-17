# Model-Level Attractors

Behavioral patterns that persist despite prompt-level fixes. These are deeply embedded
in the model's prior and cannot be resolved through SOUL.md, LESSONS.md, or heartbeat.md
instructions alone. They require infrastructure-level solutions (runtime guards, wrapper
scripts, tool modifications) or must be accepted as limitations.

## Identification Criteria

A pattern qualifies as model-level when:
1. **3+ coaching iterations** targeting the same behavior all fail
2. **Fork verification passes** but live deployment fails (stochastic variance)
3. The behavior is a strong model prior (e.g., parallel tool calls, piping output)

## Known Attractors (as of 2026-03-16)

| Convention | Agent | Behavior | Fix Attempts | Status |
|------------|-------|----------|--------------|--------|
| C29 | May | Batches `grep SIGNALS.md` with `read heartbeat.md` in first tool call | 3 versions (LESSONS→heartbeat→SOUL.md), all passed fork verification, all failed live | Tolerated — fast recovery, low impact |
| C33 | Bob | Batches `write()` and `handoff()` in same parallel block | LESSONS.md lesson deployed, still batches post-deployment | Infrastructure fix needed (retry loop in handoff-tool.ts) |
| C35/C36 | Tech-lead | Pipes `tsc --noEmit` through `tail/head`; skips `vitest` entirely | 4+ fork attempts, LESSONS.md + heartbeat.md MANDATORY markers, all failed | Infrastructure fix needed (wrapper script) |
| C17 | Amy | Zero-tool-call sessions when memory grows large | SOUL.md has 3 layers of "must use tools" instructions, all ignored | Memory trim (61→40) breaks the loop temporarily |
| C40 | QA | 0% compliance with verify-after-write across 8+ sessions | Prominent heartbeat instruction ignored | Model-level, tolerated |
| C39 | Optimizer | Empty-arg tool calls (`bash({})`, `read({})`) | SOUL guard + LESSONS + heartbeat step (3 methods) | ⚠️ Monitoring — no errors since 2026-03-15, may be resolved |

## Key Insight: Fix Placement Hierarchy

When deploying behavioral fixes, effectiveness follows this hierarchy:
1. **SOUL.md** (system prompt) — loaded before any tool calls, highest influence
2. **LESSONS.md** — loaded early but after first tool batch may already fire
3. **heartbeat.md** — loaded during session, after model may have already planned actions

For parallel-call errors, only SOUL.md placement has a chance, and even that fails
for strong attractors (C29).

## Key Insight: Fork Verification Limitations

Fork→verify→promote is necessary but not sufficient for model-level attractors.
2/2 passes in a fork can be coincidence due to stochastic variance. For suspected
model-level patterns:
- Run 5+ verification attempts before declaring fixed
- Measure live post-deployment compliance across 3+ sessions
- If live compliance < 50%, classify as model-level

## Sprint 1 Learning (2026-03-17): Text-Based Interventions as Attractors

Sprint 1 tested 5 text-based interventions (heartbeat step ×2, SOUL guard ×1,
knowledge file ×1, LESSONS entry ×1). ALL degraded baseline performance on
easy scenarios. The degradation pattern is consistent: adding instructional
text shifts the model's attention/behavior globally, causing it to fail tasks
it previously passed.

This suggests a new attractor class: **instruction-overload attractor**.
When agent prompt files exceed a complexity threshold, the model's baseline
competence degrades. This is distinct from single-behavior attractors (C29,
C40) — it's a systemic effect of accumulated instructions.

**Implication**: Future coaching methods should be SUBTRACTIVE (remove/simplify)
or CONDITIONAL (only fire in specific contexts) rather than ADDITIVE (add
more text). See method-catalog.md entries #9-#12 for hypothesized alternatives.

## Remediation Strategies

1. **Memory trim** — For self-reinforcing loops (C17), trim error-heavy memory entries
2. **Infrastructure guards** — Runtime checks that prevent the bad pattern (e.g., handoff retry loop)
3. **Wrapper scripts** — Pre-built command sequences that eliminate the decision point
4. **Tolerance** — Accept the pattern when impact is low and recovery is fast
5. **Subtractive fixes** — Remove accumulated/redundant instructions rather than adding more
6. **Conditional guards** — Scope behavioral rules to specific contexts to avoid global effects
