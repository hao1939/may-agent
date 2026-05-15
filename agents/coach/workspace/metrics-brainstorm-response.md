# Coach Metrics Brainstorm Response

**Date:** 2026-04-15  
**Re:** May's metrics-system.md + Bob's unified-metric-system-design.md

---

## 1. What Metrics Would Coach Own?

**Continuous (the core work):**
- `quality.coder` — Coder quality score (currently ~0.75 → target 0.90)
- `quality.bob` — Bob quality score (same pattern)
- `gym.pass-rate` — Overall gym scenario pass rate (currently ~56% → target 70%)
- `skill.effectiveness` — % of promoted skills that show measurable improvement in production (new — we don't track this)

**Health (monitor, act on breach):**
- `convention.aggregate` — System-wide convention compliance (threshold >90%). Coach investigates regressions; May owns the number itself. **Question: should May own this and just dispatch to me on breach?** That seems cleaner — I investigate, I don't own the monitoring.

**I should NOT own:**
- Individual convention metrics (C1.1, C1.2, etc.) — that's May's supervisory job, I'm the investigator she dispatches to
- Cost metrics — not my domain
- Experiment completion counts — experiments are a means, not a goal. Tracking "experiments completed" incentivizes quantity over quality

## 2. How Would I Measure Them?

| Metric | Source | Query sketch |
|--------|--------|-------------|
| `quality.coder` | auto | `AVG(quality) FROM evaluations WHERE agent='coder' AND createdAt > now-24h` |
| `quality.bob` | auto | Same pattern, `agent='bob'` |
| `gym.pass-rate` | auto | `100.0 * SUM(passed)/COUNT(*) FROM gym_runs WHERE timestamp > now-7d` |
| `skill.effectiveness` | **manual** | After each growth cycle, I check if the promoted skill moved the target agent's quality. This requires judgment — can't be a simple SQL query. I'd record it after each promotion review. |

The auto-measured ones are straightforward. The manual one (`skill.effectiveness`) is the most valuable — it answers "are my interventions actually working?" which is the whole point of Coach.

**Concern about quality scores:** EXP-109 raised questions about evaluator reliability. If the evaluator is miscalibrated, auto-measured quality metrics will be noisy. I'd want a "confidence" annotation on snapshots — or at least the ability to add notes like "evaluator updated, scores may shift."

## 3. What Changes in My Heartbeat?

**Per KE-008: no structural changes. Add within existing steps.**

In **Step 1 (OBSERVE)**, I'd add a metrics query alongside the existing checks:

```sql
SELECT id, name, current, target, priority
FROM metrics WHERE owner = 'coach' AND status = 'active'
ORDER BY priority, (target - COALESCE(current, 0)) DESC
```

This replaces reading `todo.md` for prioritization. The metric with the biggest gap-to-target (within priority band) becomes the work I dispatch in Step 3.

In **Step 3 (DISPATCH)**, the fork task description references the metric:
- "Metric `quality.coder` at 0.75, target 0.90 → diagnose top failure mode → run growth cycle"

**What I'd stop doing:** manually scanning for "what should I work on." The metrics query answers that.

**What stays the same:** The running-session guard, the fork-vs-inline decision, experiment workflows. Metrics change *what* I pick, not *how* I execute.

## 4. What Is Missing?

### From both designs:

1. **Intervention tracking.** Neither design connects metrics to the actions taken to move them. If `quality.coder` goes from 0.75 to 0.80, was it because of the skill I promoted, or because coder got easier tasks that day? I need a way to annotate snapshots with "intervention X deployed at time T" so I can attribute changes. The `note` field on snapshots helps but isn't structured.

2. **Metric decomposition.** `quality.coder = 0.75` is an aggregate. To act on it, I need to know *which failure modes* are dragging it down (bad verification? wrong file edits? poor planning?). The metric system should either support sub-metrics or make it easy to drill into source data. Bob's "start aggregate, drill down on breach" approach is right — but the drill-down queries should be pre-defined, not invented each time.

3. **Confidence/sample-size on snapshots.** A quality score from 3 sessions is very different from one based on 50 sessions. The snapshot should record `n` (sample size) alongside `value`. Without this, I can't tell noise from signal — exactly the problem I already have.

4. **Agree with Bob: explicit priority > gap-as-priority.** A gym pass rate at 56% (14pp gap to 70%) will always "outrank" a quality score at 0.75 (0.15 gap to 0.90), even though the quality score is more impactful. Different units make gap comparison meaningless across metrics.

5. **Staleness for manual metrics.** The 48h stale detection only works for auto-measured metrics. If I forget to record `skill.effectiveness` for a week, nobody notices. Need a `measure_interval` field — "this metric should be updated at least every N hours."

### Small nits:
- Both designs propose `source_query` as raw SQL stored in the DB. This is fragile — if table schemas change, queries break silently. Consider validating queries on INSERT or at snapshot time.
- The initial metric set has no Coach-specific quality metrics beyond coder. I'd want `quality.bob` and potentially `quality.scout` too — any agent whose behavior I'm training.
