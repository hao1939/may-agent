# Metrics Brainstorm Response — Tech-Lead

**Date:** 2026-04-15
**Re:** agents/shared/may-agent-docs/design/metrics-system.md

---

## 1. What Metrics Would I Own?

**Continuous:**
- `infra.persistent-task-adoption` — projects using persistent-task pattern (current: ~1, target: 10)
- `infra.dead-code-ratio` — LOC removed / LOC added ratio (tracks code health over time)
- `infra.review-branch-turnaround` — avg hours from branch creation to merge (currently unbounded — some sit for days)

**One-off (rotate as completed):**
- Whatever P1 features/fixes are on the dispatch board — prompt caching, architecture cleanup items, etc.

**Health:**
- `health.tsc-clean` — does `tsc --noEmit` pass? (threshold: 1, auto-measured)
- `health.test-pass-rate` — % of vitest tests passing (threshold: 100%, auto-measured)
- `health.review-branch-count` — number of unmerged review branches (threshold: < 5)

I would NOT own coder quality or gym pass rate — those are coach's domain. I own the infrastructure and tooling that makes everyone else productive.

## 2. How to Measure?

**Auto-measured (source_query):**
```sql
-- health.tsc-clean: binary, run tsc in snapshot handler (not SQL — shell command)
-- Would need a non-SQL measurement path, or record last-known result

-- health.test-pass-rate: same issue — needs shell execution, not SQL

-- health.review-branch-count:
-- Not in DB. Would need `git branch -r --list 'review/*' | wc -l` style measurement
```

**This exposes a gap in the design.** Many infra health metrics aren't queryable via SQL. They need shell commands (`tsc`, `git`, `vitest --run`). The `source_query` field assumes everything lives in the DB.

**Proposed fix:** Add `source_command` field alongside `source_query`. The snapshot handler runs shell commands for these metrics and records the result. Keep it simple — stdout is parsed as a number.

**Manual metrics:** `persistent-task-adoption` — I'd count these during lens rotations and record manually. Low-frequency, no need for auto-measurement.

## 3. Heartbeat Changes?

Minimal. The design's "query my metrics → pick worst → act" loop is good in theory, but my heartbeat already has a structured rotation (feature/infra alternation, lens system). I wouldn't replace that with pure metric-chasing.

**What I'd add (within existing steps, per KE-008):**
- In the observation step: `SELECT * FROM metrics WHERE owner = 'tech-lead' AND status = 'active'` — 1 query, ~5 lines of output
- Use the result to **inform** lens/feature prioritization, not replace it
- After completing work: record metric updates if applicable

**What I would NOT do:**
- Replace lens rotation with "work on worst metric" — lenses catch things metrics don't measure
- Add a dedicated "metrics management" phase — too much overhead for a heartbeat

## 4. What's Missing?

**A. Non-SQL measurement sources.** As noted above, infra health metrics need shell commands. `source_command: "tsc --noEmit 2>&1 | tail -1 | grep -c 'error' || echo 0"` type patterns. ~20 lines added to the snapshot handler.

**B. Metric creation friction.** Who seeds the initial metrics? The design says "May seeds auto-measured ones" but doesn't specify the actual seeding mechanism. A `scripts/seed-metrics.ts` that runs once would be cleaner than inline SQL in a handler.

**C. Metric retirement / archival.** One-off metrics auto-close, but what about continuous metrics that become irrelevant? `persistent-task-adoption` might matter now but not in 3 months. Need a `paused` → `archived` lifecycle path so the active query doesn't accumulate noise.

**D. Cross-metric dependencies.** Some metrics block others. "Prompt caching" is blocked on API key (external). "Coder quality" depends on "gym pass rate" improving first. The design has `blocker` as free text — consider a `blocked_by` field referencing another metric ID for structured dependency tracking.

**E. Alert fatigue prevention.** The `metric_alerts` table will grow fast if a health metric stays below threshold. Need dedup — don't re-alert on the same metric until it recovers and regresses again. The design's `resolveRecoveredAlerts` handles recovery but doesn't prevent repeated alerts during a sustained breach.

**F. Priority override.** "Gap to target IS priority" works for continuous metrics but breaks for one-offs. A one-off with current=0, target=1 always has gap=1 regardless of importance. Need at least a `priority` enum (P0/P1/P2) for one-off metrics, even if continuous ones use gap-based ranking.

---

**Bottom line:** The design is solid — I'd implement Phase 1 as-is with the `source_command` addition. The metric system replaces scattered tracking without requiring major behavioral changes. Main risk is over-measurement — start with 8-10 metrics, not 30.
