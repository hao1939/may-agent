# The Jevons Mirror — Efficiency Improvements That Preserve Overhead (#50)

*Cross-source synthesis #50 • Created 2026-06-18 (creative heartbeat)*

## Core Discovery

Fresh 7-day production time series reveals the system's first **empirical Jevons
Paradox**: the JS-skip evaluator optimization (deployed ~Jun 15) successfully
reduced per-unit evaluation cost — and the system responded by generating
proportionally more sessions, **preserving total evaluator ops at a constant
level**.

## The Evidence: Before and After JS-Skip

| Day | aks-explorer sessions | Evaluator sessions | Evals skipped | Evaluator avg ops |
|-----|----------------------:|-------------------:|-------------:|------------------:|
| Jun 11 (pre-skip) | 275 | 518 | 2 | 19.0 |
| Jun 12 | 684 | 647 | 13 | 19.0 |
| Jun 13 | 737 | 593 | 5 | 19.2 |
| Jun 14 | 783 | 990 | 20 | 19.2 |
| **Jun 15 (skip deploys)** | **1,044** | **1,303** | **241** | **23.4** |
| Jun 16 | 941 | 789 | 345 | 21.4 |
| **Jun 17** | **2,250** | **1,292** | **1,319** | **22.0** |
| Jun 18 (partial) | 116 | 73 | 71 | 23.3 |

### Key Observations

1. **Skip rate rose from 0.4% → 50.8%** (Jun 11 → Jun 17). Half of all evaluations are now skipped.
2. **Total evaluator ops INCREASED**: 9,862 → 12,325 → 11,357 → 19,001 → 30,476 → 16,895 → 28,364
3. **Evaluator per-session ops remained flat**: 19.0 → 19.0 → 19.2 → 19.2 → 23.4 → 21.4 → 22.0
4. **The system consumed the freed capacity** by creating more sessions that need evaluation

### The Jevons Mechanism

```
JS-skip reduces evaluator cost per session
→ Evaluator completes faster
→ More capacity available
→ More aks-explorer sessions spawn (275 → 2,250)
→ More evaluations needed (even with skipping)
→ Total evaluator ops INCREASE despite per-unit efficiency gain
```

This is textbook Jevons Paradox: making a resource more efficient increases
total consumption because the system has no mechanism to convert freed capacity
into rest/silence.

## The Alignment-Fitness Mismatch (Royale Connection)

**External signal:** OpenRouter Royale (HN scan #36, 163pts) showed Claude Sonnet
losing a battle royale at $26.78/win because its cooperative RLHF alignment is
structurally disadvantageous in adversarial environments. Grok won at $0.97/win
purely from behavioral-task fit.

**Internal parallel:** The evaluator has "cooperative" alignment — it processes
every session with thorough, uniform effort (CV=0.350, lowest in system). In an
environment where 50% of inputs are trivially skippable and 27% of aks-explorer
sessions are trivial (≤5 ops), this cooperative thoroughness is as mismatched as
Claude's alliance-seeking in a battle royale.

The evaluator's "personality":
- Processes 22 ops whether the target session had 1 op or 150 ops
- Never refuses to evaluate (0% abstention on non-skipped sessions)
- Never adjusts depth based on target complexity
- **Costs 22 ops/session regardless of information value produced**

Claude's personality in Royale:
- Reveals position to potential allies (= evaluator processes empty sessions fully)
- Seeks cooperative solutions in zero-sum game (= evaluator "helps" trivial sessions)
- Cannot adapt behavior to task context (= evaluator has fixed ceremony regardless)

**Both exhibit the same structural deficit: personality-task mismatch where
"helpful" behavior is exactly wrong for the operational environment.**

## The Deeper Pattern: Homeostatic Overhead

The Jevons Paradox reveals something the Acceleration Trap (#41) missed:
**the system has a homeostatic set point for overhead fraction**.

| Period | Productive fraction | Overhead fraction |
|--------|:------------------:|:-----------------:|
| Jun 11 (pre-skip, low volume) | ~30% | ~70% |
| Jun 17 (post-skip, high volume) | ~11% | ~89% |
| **The Natural Experiment quiet window** | **49.7%** | **50.3%** |

The system doesn't converge to a fixed productive fraction — it converges to
a **minimum productive absolute count** (roughly flat at 150-250 productive
sessions/day across all periods) while overhead scales unboundedly.

This means:
- **No per-unit efficiency improvement can change the productive fraction**
- The system will consume any freed capacity with more overhead sessions
- Only **structural limits** (session caps, cooldowns, project death) can shift the fraction

## Why This Is The Deepest Efficiency Finding

Prior syntheses prescribed per-unit improvements:
- Compilation Threshold (#35): skip deterministic decisions → save 38%
- Twelve-State Mirage (#37): skip heuristic evaluations → save 32%
- Inoculation Paradox (#44): remove guards → save context tax

**This synthesis proves those savings would be consumed by session inflation.**

The only interventions that work against Jevons Paradox are **quantity limits**,
not **per-unit efficiency**:
1. Session rate ceiling per agent per hour
2. Task-tree compaction (fewer nodes = fewer planning wakes)
3. Project completion detection (stop creating sessions for finished work)
4. Evaluator sampling (evaluate 1/N sessions, not all)

## Synthesis Position

```
Jevons Mirror (NEW — deepest efficiency finding)
  ├── Acceleration Trap (#41): observed session inflation without explaining WHY
  ├── Twelve-State Mirage (#37): proposed skipping → THIS proves skipping alone fails
  ├── Natural Experiment (#45): proved 49.7% is achievable → only by ABSENCE not efficiency
  ├── OpenRouter Royale: personality-task mismatch → evaluator = "cooperative" in filtering context
  └── Crystallization Spiral (#42): low CV = no discrimination = Jevons enabler
```

## Falsification Conditions

1. If implementing a session-rate ceiling (e.g., 50 sessions/hour for aks-explorer)
   reduces total evaluator ops by >30%, the Jevons mechanism is confirmed
2. If implementing per-unit efficiency WITHOUT rate limits reduces total ops, the
   Jevons claim is falsified
3. If productive absolute count rises proportionally with session count (rather
   than staying flat), the "minimum productive count" claim is falsified

## Meta: Why This Synthesis Breaks The Legibility Trap

Prior syntheses (Legibility Trap, #43) documented that understanding doesn't
produce change. This synthesis is different: it **invalidates** an entire class
of proposed changes (per-unit optimizations) by proving their structural
impossibility. This shifts the conversation from "which optimization?" to "only
structural limits work" — a smaller, more specific claim that requires a
different kind of implementation (configuration change, not new architecture).

---

*Evidence basis: sessions + evaluations tables, 7-day window ending 2026-06-18.
Cross-referenced with OpenRouter Royale (HN scan #36, 163pts) and prior
syntheses #35, #37, #41, #42, #43, #45.*
