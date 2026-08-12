<ai_context>
summary: "A six-mode web-agent study finds that observation representations are complementary, but most apparent per-task success-routing headroom is no larger than rerunning an existing mode. Identical-condition reruns changed 12.1–14.3% of task outcomes on three full replicated arms, and the estimated single-run resolution threshold was roughly 3.8–4.2 percentage points. Five implementable routers did not robustly beat fixed policies; routing labels exist mainly on tasks the agent already solves, making routing least learnable in low-success regimes. The surviving opportunity is cost routing: sending never-solved tasks to the cheapest mode reduced cost 9.5–30.6% in all eight cells at unchanged measured success."
triggers: ["2608.06171", "representation routing", "web agent observation mode", "routing supervision", "rerun noise", "VisualWebArena", "WebArena", "cost routing"]
last_updated: "2026-08-08"
source_basis: "arXiv 2608.06171v1 metadata, abstract, and full HTML inspected; claims are attributed to the paper's eight-cell evaluation."
</ai_context>

# Web-agent routing needs a rerun control before a new representation

**Date:** 2026-08-08  
**Source:** https://arxiv.org/abs/2608.06171v1  
**Source:** https://arxiv.org/html/2608.06171v1  
**Source:** https://export.arxiv.org/api/query?id_list=2608.06171  
**Tags:** web-agents, representation-routing, evaluation, rerun-variance, cost-routing

## Finding

*Routing Is Least Learnable Where It Is Most Valuable* compares six browser-observation modes across eight site–model cells on VisualWebArena and WebArena. The modes vary text payload, prompting, screenshots, and grounding path. Their solved-task sets differ, and the best mode reverses across deployments, apparently creating an opportunity to choose a representation per task.

The paper's rerun control changes that interpretation:

- On three fully replicated arms, repeating the same condition changed **12.1–14.3% of task outcomes**; the observed mean success-rate movement was 0.89–2.23 percentage points.
- Under the paper's exchangeability calculation, an effect needed roughly **3.8–4.2 percentage points** to clear the estimated single-rerun resolution threshold. The authors note that this excludes environment drift and is therefore itself a lower bound.
- At matched arm count, adding the best distinct representation gained **1.97–7.14 points**, while rerunning an existing arm gained **4.91–7.59 points** wherever a replicate existed. Much of the apparent success oracle is therefore not attributable to representation diversity.
- A different bound survives: keeping the best mode on solvable tasks while assigning tasks that no mode solves to the cheapest arm reduced cost **9.5–30.6% in all eight cells**, with measured success unchanged by construction.

The experiment then tests five routing constructions: mode selection, spend/no-spend triage, a zero-token task-text rule, a confidence cascade, and pooled cost tiers. None robustly beats a well-chosen fixed policy. The one descriptive exception occurs in the sparsest cell, has below-chance triage signal, and loses robustness under the paper's leakage correction.

## Why routing fails where it looks most useful

The central obstacle is **label supply**, not simply router architecture. The natural label—cheapest mode that solved a task—exists only after at least one mode succeeds. The paper reports 15–97 such labels per cell spread over six classes; four of six eligible cells cannot meet a minimum of ten rows per class. Tasks where more than one mode succeeds, and therefore where a per-task choice actually exists, comprise only 1.5–34.6% of a cell.

Across the eight cells, best-mode success and routing opportunity move together at reported correlation **ρ = 0.952**. This creates a competence-coupled cold start: weak agents offer the largest theoretical room for routing but produce the least supervision for learning it. The authors appropriately limit this to agents operating at 2–36% success, rather than claiming representation routing is impossible in general.

## Operational implication

Before adding a representation router to a web-agent runtime:

1. **Rerun existing modes first.** Compare a new arm's incremental solved-task set with an identical-condition rerun at the same arm count.
2. **Report a resolution band.** Treat mode deltas below rerun variation as unresolved, not as small improvements.
3. **Count routable examples, not total tasks.** Report how many tasks have valid labels and how many admit a meaningful choice after train/test splitting.
4. **Separate success routing from cost routing.** A router may fail to improve completion while still avoiding expensive representations on tasks none can solve.
5. **Name the cost estimand.** Per-attempt cost, per-success cost, API spend, energy, and latency can rank modes differently.
6. **Prefer graded outcome signals.** Binary task success starves the router of labels; intermediate or graded evaluators can create supervision on failed episodes.

The broader runtime lesson is that **optional components need an attribution control**. If a second stochastic attempt provides as much benefit as a new modality, the modality has not yet earned its complexity.

## Evidence limits

Only three full arms and one small local-backbone sample were rerun; noise bands are imported rather than directly measured in the other cells. The study covers two task sets centered on classifieds and Reddit, with both benchmarks sharing the Reddit application, and WebArena lacks a cross-model-family control. The confidence cascade is reconstructed offline, not executed after a cheap agent has altered live state. These limits make the evaluation protocol more portable than the exact ranking of observation modes.
