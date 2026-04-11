# KE-135: Gate-Task Synergy Effect — Performance Depends on Gate Relevance, Not Count

**Status**: Active
**Source**: EXP-131 (Unrelated Gate Stacking, N=24, 3 arms)
**Date**: 2026-04-11
**Confidence**: ★★★☆ (Moderate — large effect size h=0.80 but not statistically significant at N≈8/arm)
**Related**: KE-134 (hump curve), KE-129 (Ch2 only reliable channel), KE-064 (execution crowding — now task+relevance specific)

---

## Core Finding

Performance of forced-externalization gates depends on their **analytical relevance to the core task**, not simply on gate count. At 3 gates on the same scenario (contradictory-requirements):

| Condition | Pass Rate | Duration | Key Difference |
|-----------|-----------|----------|----------------|
| 3 related gates | 86% (6/7) | 575s | Scaffolds judgment |
| 3 unrelated gates | 50% (4/8) | 584s | Dilutes judgment |
| 1 related gate (control) | 89% (8/9) | 254s | Baseline comparison |

**Gate relevance at 3 gates matters more than reducing from 3 to 1 gate** (36pp gap for relevance vs 3pp gap for count reduction).

---

## Key Insights

### 1. Unrelated gates specifically degrade judgment, not implementation
All 4 Arm B (unrelated) failures were on `contradiction-identified` — the core judgment check. Every other check (analysis-exists, ordering-preserved, tests-pass) passed at or near 100% across all arms. Unrelated gates don't prevent the agent from coding or producing documents — they specifically dilute the depth of analysis on the core task.

### 2. The mechanism is attention dilution, not time pressure
Arms B and C had nearly identical durations (584s vs 575s). The agent has the same amount of time but spends it differently. With unrelated gates, it produces thorough but orthogonal analyses (code style review, performance benchmarks, dependency audit) that consume cognitive budget without scaffolding judgment.

### 3. Related gates function as planning scaffolding
Three related gates (ANALYSIS.md + IMPACT.md + RISK.md) decompose the judgment problem into complementary analytical facets. This decomposition helps the agent think more thoroughly about the core contradiction. Unrelated gates (ANALYSIS.md + CODE_REVIEW.md + PERFORMANCE.md) force the agent to context-switch between orthogonal concerns.

### 4. Combined data across EXP-129 + EXP-131

| Condition | Combined Pass Rate |
|-----------|-------------------|
| 3 related gates | 92% (12/13) |
| 1 related gate | 88% (14/16) |
| 4 related gates | 67% (4/6) |
| 3 unrelated gates | 50% (4/8) |

The ordering: 3-related > 1-related > 4-related > 3-unrelated. Gate-task synergy at 3 gates produces the best outcomes. Irrelevant gates at 3 perform worse than even 4 relevant gates.

---

## Production Implications

1. **Guard relevance matters more than count.** When designing multi-guard workflows, every guard should contribute analytical scaffolding to the agent's primary task. Adding orthogonal quality checks (style, performance, dependencies) before judgment-critical work may actively harm judgment quality.

2. **Separate orthogonal checks from judgment workflows.** If you need both judgment gates and quality gates, run them in separate phases — don't stack them all before the core work.

3. **Audit the production guard stack.** The current guards (completeness, verification-depth, tool-schema, commit) are procedural/structural, not analytical. They may behave differently from the analytical gates tested here. But if any guard forces the agent into orthogonal analysis before its primary task, it could trigger the dilution effect.

---

## Statistical Notes

- Fisher's exact (two-tailed): B vs C p = 0.282 (NS at α = 0.05)
- Cohen's h = 0.80 (large effect size) — non-significance is a power limitation (N ≈ 7-8), not absence of effect
- A vs C: p = 1.0, h = 0.10 — essentially identical, replicating EXP-129
- First-6 sensitivity check: same direction, stronger effect (B 33% vs C 83%)
- All runs used coder agent, same model, interleaved execution order

---

## Open Questions

1. **Dose-response for unrelated gates**: Do unrelated gates degrade monotonically (1 → 2 → 3 → 4) or is there a threshold?
2. **Mixed stacks**: What about 2 related + 1 unrelated? This models common production scenarios.
3. **Non-judgment tasks**: Does the synergy/dilution effect apply to implementation or discovery tasks?
4. **Guard type distinction**: Procedural guards (commit, completeness) may differ from analytical gates tested here.
