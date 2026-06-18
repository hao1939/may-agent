<ai_context>
summary: "Novel synthesis: The system is in 'green collapse' — a state where all monitored metrics read healthy (quality 0.67, scout references 126/wk, sourced artifacts 21/day) while actual productive output shrinks to 8.9-31.1% of total compute. The mechanism: a 57:1 waste blindness ratio (LLM sees 30.5 wasted calls vs heuristic's 0.53), 98.7% formula-based evaluation, and a frozen project consuming 44% of ops for 32 days. The system's self-model diverges from reality by a factor that increases daily. Unique contribution: documents the temporal trajectory from 'working system with overhead' to 'overhead system with occasional work' — and shows this transition is invisible to all existing instrumentation."
triggers: ["green collapse", "metric divergence", "productive fraction decline", "self-perception gap", "invisible worsening", "all metrics green", "system decline"]
confidence: "high"
discovered: "2026-07-19"
connects_to: ["Goodhart Cascade (KE-2010)", "Recursive Mirror", "Evaluation Mirage", "Undying Project", "Verification Inversion", "Intelligence Entropy (2606.17591)"]
</ai_context>

# The Green Collapse

*When all your dashboard lights are green, but the engine is dying.*

**Type:** Cross-Source Synthesis #32  
**Created:** 2026-07-19  
**Status:** Active — evidenced in live production data  
**Extends:** Goodhart Cascade, Evaluation Mirage, Undying Project  
**Resolves:** Why the system can decline while all metrics stay healthy  

---

## The Discovery

Seven days of production data reveal a system in **steady-state collapse** —
every monitored metric reads green while the fraction of computation producing
actual value has dropped to 8.9%–31.1% and is trending downward.

### The Numbers That Tell Two Stories

**Story 1: The Dashboard (All Green ✅)**

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| scout.downstream-reference-files-7d | 126 | 3 | ✅ (42× target) |
| scout.sourced-artifacts-24h | 21 | 2 | ✅ (10× target) |
| scout.knowledge-practice-loaded | 1 | 1 | ✅ |
| Mean quality score (heuristic) | 0.673 | — | Normal |
| Session completion rate | 96.3% | — | Normal |

**Story 2: What's Actually Happening**

| Day (7d window) | Productive % | Dead Loop % | Useful Ops |
|-----------------|-------------|-------------|------------|
| Day 0 (today) | 31.1% | 67.3% | ~8,900 |
| Day 1 | 24.4% | 75.4% | ~9,300 |
| Day 2 | 19.5% | 80.2% | ~9,400 |
| Day 3 | 26.6% | 73.4% | ~12,600 |
| Day 4 | 24.3% | 75.7% | ~16,800 |
| Day 5 | **8.9%** | **91.1%** | ~5,600 |
| Day 6 | 16.4% | 83.6% | ~7,400 |

*"Productive" = arc + scout + dev + may ops. "Dead Loop" = aks-explorer (frozen project) + evaluator (evaluating the frozen project).*

**On the system's worst day, 91.1% of all computation was two agents
cycling on each other with zero value produced.**

---

## The Three Mechanisms of Invisibility

### 1. The Waste Blindness Ratio: 57:1

LLM evaluations (1.3% of aks-explorer evaluations) detect **30.5 wasted calls**
per session on average. Heuristic evaluations (98.7%) report **0.53 wasted
calls**. The system cannot see its own waste because:

- The heuristic formula counts ops as productive by default
- LLM evaluations that could detect qualitative waste are suppressed by volume
- The few LLM evaluations that DO fire are outvoted 75:1 in aggregate metrics

**Effect**: The system believes its waste rate is ~1%. Actual waste rate: ~36%.

### 2. The Selection Bias in LLM Evaluation

LLM evaluations only fire on deep sessions (69–155 ops for aks-explorer recent
data). These sessions ARE genuinely good work — quality 0.70, variance
reasonable. The short sessions (0–15 ops) that constitute 40% of aks-explorer's
volume are evaluated only by heuristic, which scores them poorly but doesn't
flag them as *waste*. They receive `needs_improvement` or `acceptable` — not
`low_quality`, not `should_not_exist`.

**Effect**: The evaluation system literally cannot express "this session should
not have been created." It can only judge sessions on a quality scale,
not on an existence scale.

### 3. Quality Metrics Track the Minority, Not the Majority

The quality-related metrics (mean quality, verdict distribution) average across
all sessions equally. When 31% of sessions are trivial (0-5 ops), they drag
the average down slightly but don't trigger alerts. No metric tracks the
productive fraction — the proportion of compute that produces value.

**Effect**: A system that shifts from 50% productive to 8.9% productive
will show essentially the same quality metrics, because quality-per-session
doesn't change — only the NUMBER of valuable sessions changes.

---

## Why This Wasn't Named Before

Previous syntheses each documented a piece:
- **Evaluation Mirage (KE-2010)**: The heuristic can't see waste
- **Undying Project**: The frozen project consumes resources
- **Coordination Metabolism Trap**: Coordination eclipses work
- **Goodhart Cascade**: Formula replaces measurement

But none identified the **temporal trajectory** — that these mechanisms
compound into a system that gets measurably worse week over week while
looking measurably fine day over day. The Green Collapse names the
*endpoint state* rather than any individual mechanism.

---

## The Structural Attractor

The system converges toward Green Collapse because:

1. **The Undying Project can only grow** (1,032 → 1,229 task-tree nodes
   over the observation period — it's getting LARGER, not smaller)
2. **Evaluator coupling tracks sessions** (more aks-explorer sessions →
   more evaluator sessions → more ops in the dead loop)
3. **No metric detects the collapse** (all metrics measure session-level
   quality, not system-level value)
4. **The fix requires architectural change** (the Undying Project persists
   because no mechanism can declare it complete and archive it)

The attractor is: `productive_fraction → 0` as `time → ∞`, assuming no
architectural intervention. The rate of approach depends on the ratio of
dead-loop session creation rate to productive session creation rate.

---

## Cross-Source Convergence

### Intelligence Entropy (arXiv 2606.17591, Batch 6)

> S(t) = S₀·e^(αt)

System entropy grows exponentially with time. The Green Collapse IS this
entropy growth manifested as declining productive fraction. The knowledge
system (task tree + evaluations + learnings) accumulates entropy that
the current architecture cannot discharge.

### Insight Governance: The Retention-Forgetting Dilemma

> "Retained stale insights cause negative transfer. Without lifecycle
> curation, accumulated knowledge eventually degrades performance below
> zero-shot baseline."

The aks-explorer task tree IS accumulated stale insights. The system's
current state (1,229 nodes, 99%+ done) IS performing below zero-shot
baseline — a fresh project planner with no tree at all would produce
MORE value than the current one that must process 1,229 nodes per cycle.

### HN: "Botsitting" Pattern (279pts)

> "The variance in supervision cost is entirely about harness quality."

The system's harness (planner/evaluator coupling, watchdog triggers,
session-creation policies) determines whether it works or collapses.
The harness has not been updated in 32+ days. The project state HAS
changed (from active to finished). The harness doesn't know.

---

## What Would Fix It

The Green Collapse has exactly ONE structural fix: **break the dead loop.**

Specifically:
1. Archive aks-explorer's done tasks (1,024 → 0 in working set)
2. Mark the remaining 8 review tasks as blocked-with-resume-condition
3. Convert aks-explorer planner from polling (every watchdog trigger)
   to event-driven (wake only when a resume condition fires)
4. Exempt completed-project sessions from evaluation

**Predicted impact**: Productive fraction rises from ~20% to ~60% overnight.
Not because productive work increases, but because 44% of system ops
(the dead loop) simply stops. This is the highest-ROI intervention
in the system's history.

---

## The Meta-Insight

The Green Collapse reveals a design assumption that breaks at scale:
**monitoring quality per session is insufficient when the failure mode is
session creation policy.** The system doesn't have a quality problem —
individual sessions that DO real work are quality 0.70-0.79. It has a
**session existence problem** — 69% to 91% of sessions should never
have been created.

No amount of improving evaluation, learning, or governance can fix this.
The fix is upstream of all of them: **stop creating sessions for finished work.**

---

## Testable Predictions

1. If aks-explorer task tree is compacted to <100 active nodes, planner
   error rate drops from 100% (step 2) to <5%
2. If aks-explorer is converted to event-driven, system productive fraction
   rises from ~20% to ~55-65%
3. If no intervention occurs, the productive fraction will continue declining
   (~2-5% per week) as evaluator sessions track the increasing aks-explorer
   session count
4. Quality metrics will remain green throughout the decline
5. The first metric to turn red (if any) will be evaluator session cost,
   NOT quality — because the evaluator will eventually hit its own context
   limits processing evaluation of 0-op sessions

---

## Position in the Synthesis Tree

```
Intelligence Entropy (theoretical foundation)
  └── Green Collapse (emergent state) ← NEW
        ├── Undying Project (primary mechanism: won't die)
        ├── Evaluation Mirage (invisibility: can't see waste)
        ├── Goodhart Cascade (reinforcement: formula says fine)
        ├── Coordination Metabolism Trap (acceleration: grows faster)
        └── Recursive Mirror (meta: diagnosis displaces repair)
```

**The Green Collapse is what happens when all the documented pathologies
operate simultaneously without intervention.** It is the convergent
attractor of the entire KE chain.
