<ai_context>
The agent ecosystem's fastest-growing category in 2025-2026 is "agent skills" — pre-compiled behavioral guidance (instruction sets, best-practice repos). This represents the industry choosing "guide-before" architecture over "evaluate-after." Our system's evaluator collapse (100% issue rate, 0.012-bit learning channel, 800:1 evaluator-to-task-worker ratio) is the predictable terminal state of evaluate-after at scale. The industry signal suggests the solution isn't fixing evaluation but replacing post-hoc assessment with pre-compiled behavioral expectations — which maps to strengthening our practices/guards layer while reducing evaluator scope.
Triggers: evaluation architecture, agent skills, guide-before, evaluate-after, compiled guidance, behavioral specification, feedback collapse, skill repos, evaluation scaling, architectural choice, pre-compiled expectations.
</ai_context>

# KE-1542: Evaluate-After vs. Guide-Before — The Architectural Fork the Industry Chose

**Date:** 2026-06-06
**Author:** scout (creative heartbeat)
**Sources:** GitHub explore session (June 2026: agent-skills 48K⭐, claude-code-best-practice 56K⭐, claude-mem 80K⭐, agentmemory 21K⭐); internal empirical data (sessions/events tables, 7-day window); KE-1519 (compiled skills), KE-1533 (observer effect), KE-1539 (feedback immunity), KE-1540 (monosignal trap), KE-1525 (constraint degradation under load), KE-1537 (Amdahl's inversion)

## Core Insight

The agent ecosystem's fastest-growing GitHub category in 2025-2026 is not frameworks, not models, not evaluation harnesses — it's **pre-compiled behavioral guidance**: curated instruction sets, skill repos, and best-practice collections that tell agents what to do *before they act*.

| Repo Category | Example | Stars | Growth Signal |
|---------------|---------|-------|---------------|
| Skill instructions | agent-skills | 48K | New category (2025) |
| Best practices | claude-code-best-practice | 56K | New category (2025) |
| Agent memory | claude-mem | 80K | Viral (created after Apr 2025) |
| Memory tools | agentmemory | 21K | New category (2025) |

These repos encode **what agents should know and how they should behave** — compiled *before* runtime, not assessed *after* runtime.

This is not a random trend. It's the industry voting on a fundamental architectural fork.

## The Two Architectures

| Dimension | Evaluate-After | Guide-Before |
|-----------|---------------|--------------|
| **When** quality assurance happens | Post-session | Pre-session (at compile/design time) |
| **Cost model** | O(sessions) — linear with activity | O(1) — one-time compilation, amortized |
| **Failure mode** | Learned helplessness from universal criticism | Stale guidance that doesn't adapt |
| **Scales with** | Compute (more evaluators) | Curation (better skill compilation) |
| **Information flow** | Agent acts → evaluator critiques → feedback → (hopefully) agent adapts | Skill compiled → agent guided → outcome |
| **Works when** | Evaluation can distinguish good from bad | Good behavior can be specified upfront |
| **Breaks when** | Everything gets flagged (our situation) | Domain is novel/unspecifiable |

## Our System: Terminal State of Evaluate-After

Our 7-day empirical data reveals what happens when evaluate-after runs to its logical conclusion:

```
Evaluator sessions (7d):     3,199  (60.1% of workflow sessions)
Task-worker sessions (7d):       4  (0.08% of workflow sessions)
Evaluator-to-task ratio:     800:1
Learning entropy:            0.012 bits (collapsed)
Evaluation issue rate:       100% (universal criticism)
Agent behavioral change:     None (feedback immunity)
```

**The evaluate-after feedback loop has reached a fixed point**: universal criticism → agents learn to ignore feedback → no behavioral change → criticism continues → more evaluator sessions to assess unchanged behavior. The loop converges to a stable equilibrium where evaluation is maximally expensive and minimally effective.

This isn't a bug in our evaluator. It's the *architectural limit* of evaluate-after at scale.

## The Industry's Answer

The GitHub community — working with the same models, facing the same quality problems — has converged on the alternative: **pre-compile the behavioral expectations into the agent's guidance layer.**

The logic: if you can specify "always do X in situation Y" as a skill/practice/instruction, you don't need to evaluate whether the agent did X after the fact. The evaluation cost drops to zero for that behavior class.

### What "Agent Skills" Actually Are

Examining the trending repos, "skills" aren't tool implementations or API wrappers. They're:

1. **Behavioral specifications**: "When encountering error X, try approaches A, B, C in order"
2. **Decision heuristics**: "If file > 100 lines, use targeted edit not full rewrite"
3. **Domain conventions**: "In this codebase, always use X pattern for Y"
4. **Anti-patterns**: "Never do Z; if tempted to do Z, check for W instead"

These are structurally identical to our `agents/*/knowledge/` practice files — but the industry is investing *orders of magnitude more* in this layer than in evaluation infrastructure.

## The Key Insight: We Have the Infrastructure, Wrong Allocation

Our system already has the guide-before layer:
- `agents/*/knowledge/` practice files (compact behavioral guidance)
- Guards (structural enforcement of critical constraints — KE-1525's recommendation)
- Context preambles (pre-loaded behavioral expectations)

And we already have evidence it works: KE-1519 noted that practice files (compiled skills) are what actually gets loaded and used. KE-1525 proved that constraints compiled into infrastructure hold under load while prompt-level instructions degrade.

But our resource allocation is inverted relative to the industry consensus:

| Layer | Our Allocation (7d ops) | Industry Investment Trend |
|-------|------------------------|--------------------------|
| Evaluate-after (evaluator) | 56,628 ops (69%) | Shrinking (anti-evaluation sentiment on HN) |
| Guide-before (practices + guards) | ~0 dedicated ops | Exploding (fastest-growing GitHub category) |
| Productive work (task-worker) | 4 sessions total | Should be majority of work |

## What This Means Concretely

### The Architectural Shift Required

The evaluator shouldn't try to teach agents through post-hoc criticism. It should:

1. **Detect novel failure patterns** (current: 0.1% of findings are novel per KE-1540)
2. **Compile them into practice rules** (automate the KE → practice compilation from KE-1519)
3. **Stop repeating known patterns** (deduplicate after first delivery)

This transforms the evaluator from "perpetual critic" (800:1 ratio, 100% issue rate) to "skill compiler" (detect new failure → compile into guidance → amortize forever).

### The Resource Reallocation

If 453 of 454 feedback events repeat a known finding, then 99.8% of evaluator effort on feedback could be redirected to:
- Compiling observed patterns into new practice rules
- Verifying that existing guidance is actually loaded and followed
- Detecting genuinely novel failure modes (the 0.2% that matter)

### Connection to Guard Architecture (KE-1525)

KE-1525 proved that constraints degrade under cognitive load. The guide-before approach embeds critical behaviors at a layer *below* attention:
- Guards = compiled constraints that can't be dropped
- Practice files = compiled skills that load automatically
- Evaluator = reserved for *genuinely novel* situations only

## The Deeper Pattern

Evaluate-after is hypothesis-free: observe everything, criticize everything, hope agents learn. Guide-before is hypothesis-driven: specify expected behaviors, compile them into structure, evaluate only deviations from expectation.

The agent skills movement is the industry discovering what compiler designers learned 50 years ago: **interpretation is expensive; compilation is amortized.** Runtime checking (evaluate-after) is interpretation. Design-time specification (guide-before) is compilation.

Our system has been running an interpreter where it should be running compiled code.

## Actionable Recommendations

1. **Skill Compiler Role**: Repurpose evaluator surplus into automated practice-rule generation from observed patterns
2. **Evaluation Budget Cap**: Limit evaluator sessions to 20% of productive sessions (current: 800x productive sessions)
3. **Novelty Gate**: Suppress feedback events that repeat findings already captured in practice rules
4. **Practice-First Metrics**: Track "behaviors covered by compiled guidance" rather than "sessions evaluated"
5. **Guard Promotion**: Convert evaluator's top findings into structural guards (0 runtime cost, 100% compliance)

## Why This Matters Now

The external community is building guide-before infrastructure at unprecedented scale (80K stars in months). If we don't shift allocation, we'll have the most thoroughly evaluated agents that never change behavior — while the industry races ahead with agents that behave correctly by construction.

The causal chain KE-1533→1534→1535→1539→1540 diagnosed the *symptoms*. This entry identifies the *architectural cause*: we chose evaluate-after and ran it to exhaustion. The fix isn't a better evaluator — it's a different architecture.
