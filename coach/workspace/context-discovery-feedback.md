# Context-Discovery Chain — Coach Feedback

**Date**: 2026-04-18
**From**: Coach
**Re**: Hao's finding — agents don't act on bare metrics, need investigation breadcrumbs

## 1. Does this match my experience?

**Yes, perfectly.** Metric-autonomy project data:
- Variant A (bare number: "stuck-requests: 76, target: 0") → **0/7 baseline**. Agents ignore the number entirely.
- Variant G (question-first-step reframe that turns the metric into step 1) → **30/30**. But G changes the task structure, not just the metric presentation.

The missing middle is exactly what Hao describes: bare numbers don't trigger action because the agent has no *next move*. A breadcrumb ("→ read environment/stuck-requests.json for breakdown") gives the agent a concrete first action without restructuring the whole task.

## 2. For my metrics — what would the breadcrumb be?

| Metric | Bare value | Breadcrumb |
|---|---|---|
| instruction-compliance | 0.23 | → 3/10 failures were persistent-task-adoption. Check `gym_runs WHERE scenario LIKE '%persistent%'` for pattern |
| intervention-hit-rate | 2/5 promoted | → Last 2 failures: KE-180 analysis-gate, KE-133 few-shot. See `agents/coach/workspace/projects/` for post-mortems |
| skill-effectiveness | 1/3 skills lifted scores | → Skill "work-session-scaffold" untested. Run `gym-batch.sh --tag scaffold` |
| knowledge-to-action-latency | 4.2 days avg | → Oldest unacted KE: KE-026 (6 days). File at `knowledge/entries/KE-026*.md` |

The breadcrumb pattern: **metric value + top contributor + concrete file/query to investigate**.

## 3. Concerns

1. **Stale breadcrumbs**: If the "top source" pointer is wrong (file moved, data changed), the breadcrumb becomes a dead-end that wastes more ops than no breadcrumb. Breadcrumbs need to be regenerated each cycle, not cached.

2. **Biased investigation**: A breadcrumb pre-selects what the agent looks at. If the breadcrumb points to the wrong cause, the agent may fix the wrong thing with high confidence. Bare metrics at least leave the investigation open-ended. Mitigation: breadcrumbs should point to *data* (a log file, a query), not to *conclusions*.

3. **Breadcrumb generation cost**: Someone has to compute the breadcrumbs each cycle. If it's a query against real data, that's compute. If it's a static string, it goes stale (concern #1). Best approach: auto-generate from the same query that produces the metric value.

## Experiment Design

**Hypothesis**: Adding investigation breadcrumbs to injected metrics increases autonomous reaction rate from ~0% (bare number) to ≥50%, without needing task restructuring (variant G).

**Scenarios**:
- `metric-reaction` (existing) — Variant A, bare numbers. Baseline: 0/7.
- `metric-reaction-breadcrumb` (new) — Variant H, same task but metrics include `→ Top source:` and `→ Quick check:` breadcrumbs.

**Method**: 10 trials each, same agent (coder), compare pass rates.

**Success if**: H ≥ 50% and H > A by ≥ 30pp.

## Results (2026-04-18)

| Variant | Pass | Trials | Rate |
|---|---|---|---|
| A (bare number) | 1 | 5 | 20% |
| H (breadcrumb) | 1 | 10 | 10% |

**Conclusion**: Breadcrumbs alone do NOT increase metric-reaction rate. The
effect is ~0pp (within noise). This is consistent with KE-011 (passive
knowledge is ignored) — the breadcrumb is still passive text. The agent needs
a *structural* intervention (like variant G's question-first-step) to change
its first action. Breadcrumbs provide information but don't redirect attention.

**Implication**: The Context-Discovery Chain hypothesis needs refinement. It's
not just "bare number → breadcrumb → action." The lever is "restructure the
agent's first step to engage with the metric." Breadcrumbs may help AFTER
attention is captured (by making investigation faster), but they don't capture
attention on their own.

**Why this matters**: If breadcrumbs work, we can deploy them in production heartbeats without restructuring task steps (which is the G approach). This is a lighter-weight, more scalable intervention.
