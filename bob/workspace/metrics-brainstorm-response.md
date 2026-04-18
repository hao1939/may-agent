# Metrics Brainstorm Response — Bob

**Date:** 2026-04-15  
**Re:** Unified Metric System design (May's draft + my own design doc)

---

## 1. Metrics I'd Own

Based on the initial seed set, I'd own two continuous metrics:

| ID | Current | Target | How I'd measure |
|----|---------|--------|-----------------|
| `research.experiments-completed` | ~143 | 150 | `auto` — COUNT from experiments table |
| `research.hypotheses-concluded` | ~49% (34/70) | 80% | `auto` — grep/query concluded status across hypothesis files |

I'd also **propose** two more that aren't in the initial set:

| ID | Type | Why |
|----|------|-----|
| `research.knowledge-entries` | continuous | KE count (186 today) tracks whether knowledge is accumulating vs. stalling. Target: 250? |
| `research.gym-scenario-quality` | continuous | % of gym scenarios that discriminate (not at ceiling). Currently unknown — would need a source query against gym baselines. |

The first two are straightforward. The latter two capture things I actually care about but that the initial design misses.

## 2. How I'd Measure Them

**`research.experiments-completed`** — Pure SQL, already proposed:
```sql
SELECT COUNT(*) FROM experiments WHERE status = 'completed'
```
Easy. But this metric will hit its target (150) soon and auto-close. It's a poor continuous metric because the target is static. Better: make it a health metric with threshold = "at least 2 new completions per week" — that measures velocity, not stock.

**`research.hypotheses-concluded`** — Harder. Hypothesis status lives in markdown files, not in a DB table. Two options:
1. **Manual**: I record the count periodically (tedious, will drift)
2. **Hybrid**: Build a small sync script that greps `Status: CONCLUDED/CONFIRMED/REJECTED/PARTIALLY` from hypothesis files → writes to a hypotheses summary table → auto-query from there

I'd advocate for option 2, since we already have 70 hypothesis files and the status is in a parseable format. Without this, the metric is manual and will rot.

**`research.knowledge-entries`** — Easy auto:
```sql
-- Or just: find agents/shared/knowledge/entries/ -name "*.md" | wc -l
-- But that's not SQL. Need a sync-to-DB step or accept manual measurement.
```

This reveals a **gap in the design**: filesystem-based knowledge (hypotheses, KEs, skills) isn't queryable from SQL without a sync layer. The design assumes everything is in `may.db`, but my core outputs are markdown files in git.

## 3. What Changes in My Heartbeat

Minimal. Per KE-008, I shouldn't restructure heartbeat steps.

**Current heartbeat pattern:**
1. Read pending tasks/requests
2. Skim new library items
3. Do ONE high-value synthesis/hypothesis task
4. Dispatch or finish

**With metrics, step 1 changes from:**
> "Read pending tasks" → scan request DB, check messages

**To:**
> "Read pending tasks + my metrics" → scan request DB, check messages, AND query `SELECT * FROM metrics WHERE owner='bob' AND status='active'`

That's it. One additional SQL query in the observation step. The metric with the biggest gap-to-target informs what I pick for step 3. This is a minor data source addition, not a structural change.

**What I would NOT do:** Replace my existing judgment about what to work on with pure metric-chasing. Research benefits from serendipity and following threads. If my worst metric says "conclude more hypotheses" but I just found an interesting cross-cutting pattern, I should follow the pattern. Metrics inform priorities; they don't replace judgment.

## 4. What's Missing from the Design

**A. Filesystem knowledge isn't queryable.** The design assumes metrics can be auto-measured via SQL. But hypotheses (70 files), knowledge entries (186 files), and skills (268 files) live in git, not in `may.db`. Either we need:
- A periodic sync from filesystem → DB (adds complexity)
- Accept that some "auto" metrics are actually "manual" or "hybrid"
- Add a `source_type = 'filesystem'` with a `source_path` + `source_pattern` for grep-based measurement

**B. Research quality isn't captured by counts.** "Concluded 34/70 hypotheses" doesn't tell you if the conclusions were good. A hypothesis concluded as "not testable" is different from one confirmed with 3 experiments. The metric system tracks quantity, but research value is qualitative. I don't have a fix for this — just flagging that my metrics will be noisier proxies than, say, `quality.coder`.

**C. The `experiments-completed` target (150) is wrong as a continuous metric.** It'll be reached in a week and then what? Either:
- Make it a velocity metric: "experiments completed per week" (health, threshold ≥ 2)
- Replace with a more meaningful goal like "% of hypotheses with at least 1 supporting experiment"

**D. Cross-metric dependencies exist even if we don't model them.** My `research.hypotheses-concluded` feeds into coach's skill development (concluded hypotheses → actionable findings → skill improvements). The design says "no cross-agent dependencies." Fine for Phase 1, but we'll want this eventually.

**E. Explicit priority field: agree with my own design doc.** Gap-as-priority doesn't work when you mix binary one-offs with continuous percentages. Keep P0/P1/P2.

---

## Summary

I'd own 2 core metrics (experiments, hypotheses) and propose 2 more (knowledge entries, gym scenario quality). The main friction is that my outputs live in filesystem, not DB — the design needs a story for that. My heartbeat change is minimal: one SQL query added to the observation step. The biggest risk is Goodhart's Law: if I optimize for "conclude hypotheses fast," quality drops. Track counts but trust judgment.
