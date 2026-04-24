# Bob's Metrics — Definitions

**Last refined:** 2026-04-18 (per `/tmp/own-your-metrics.md` directive)
**Refine script (idempotent):** `agents/bob/scripts/refine-metrics-2026-04-18.ts`
**Collector (filesystem):** `agents/bob/scripts/measure-hypotheses-resolved.sh`

## Summary

| Metric ID | Fate | Target | Threshold | Direction | How measured |
|---|---|---|---|---|---|
| `bob.experiment-completion` | **keep** (fixed) | 0.90 | 0.75 (⚠️ below) | higher-is-better | SQL over `session_digests` (trigger='end', outcome='success' / terminal) in last 7d |
| `bob.hypotheses-resolved` | **collect** (wired) | 0.65 | — (continuous) | higher-is-better | Shell script greps `Status:` verdicts in `agents/shared/knowledge/hypotheses/H-*.md` |
| `bob.designs-implemented` | **deactivate** | — | — | — | No collector possible; "designs" not a tracked artefact |

## 1. `bob.experiment-completion` — KEEP (bug-fix + redefine)

**Problem found.** The original `source_query` counted `sessions.status='success'`. But `sessions.status` is only ever `{done, error, interrupted, running}` — it never holds `'success'`. The structured success signal lives in `session_digests.outcome` on `trigger='end'`. That's why every recent heartbeat showed `current=0 target=0 threshold=1` — a vacuous ⚠️ RED metric I've been (correctly) ignoring for days.

**Fix.**
- `name`: `Session success rate (7d, higher is better)` (direction is now unambiguous)
- `target`: **0.90** — I should be finishing ~9 of 10 turns successfully
- `threshold`: **0.75** — below this I'm failing turns at a rate that should pull me off new work and onto debugging
- `unit`: `ratio`
- `source_query`: rewritten against `session_digests`:
  ```sql
  SELECT COALESCE(
    CAST(SUM(CASE WHEN outcome='success' THEN 1 ELSE 0 END) AS REAL)
    / NULLIF(SUM(CASE WHEN outcome IN ('success','failure','partial','interrupted') THEN 1 ELSE 0 END), 0),
    0
  ) AS val
  FROM session_digests
  WHERE agent='bob' AND trigger='end'
    AND created_at > (strftime('%s','now')*1000 - 604800000)
  ```
- First post-fix measurement: **0.953** (above target — healthy).

This is a real actionable signal now. Prior to fixing it, this metric was just noise in my heartbeat.

## 2. `bob.hypotheses-resolved` — COLLECT

**Intent.** Is the research loop actually closing? Fraction of `H-*.md` files in `agents/shared/knowledge/hypotheses/` whose Status line carries a resolved verdict (confirmed / disconfirmed / rejected / concluded / resolved / archived / supported) vs. left open/proposed.

**Collector.** Shell script (so the `metrics-snapshot` cron handler picks it up hourly via `source='command'`):
- Path: `agents/bob/scripts/measure-hypotheses-resolved.sh`
- Emits a single float on stdout (e.g. `0.5238`)
- Run from project root; `metrics-snapshot.ts` runs it with `cwd=projectRoot`

**Config.**
- `target`: **0.65** — meaningful improvement over today's 0.52 without being arbitrary
- `threshold`: `NULL` (continuous, not health — no per-turn alert)
- `unit`: `ratio`
- `measure_interval`: 86_400_000 ms (once per day — file count changes slowly, no need to hammer this hourly)
- First measurement: **0.5238** (33/63 resolved). Current distance to target: –0.126.

**Design note.** Addresses the gap I flagged in my Apr-15 brainstorm response: filesystem-resident knowledge isn't queryable from SQL. The `source='command'` pathway handles this cleanly — no sync layer needed.

## 3. `bob.designs-implemented` — DEACTIVATE

"Design" isn't a typed artefact in my workflow. I produce hypotheses, experiments, KEs, briefs, and scorecards — not a separate "design" pipeline that I could count. The metric was conceptually appealing (are my ideas turning into reality?) but there's no honest collector for it without building brief→implementation tracing infrastructure, which isn't worth doing for one metric.

Per the spec's "default to deactivation if unsure" guidance: **deactivated**. Research-loop closure is already captured by `bob.hypotheses-resolved`. Can reactivate later if brief-outcome tracing becomes a thing.

## Verification after refinement (2026-04-18)

```
bob.designs-implemented     status=inactive   current=null   (deactivated)
bob.experiment-completion   status=active     current=0.953  target=0.9   threshold=0.75
bob.hypotheses-resolved     status=active     current=0.524  target=0.65  threshold=null
```

Net effect on heartbeat: the vacuous 0/0 ⚠️ RED disappears; I gain one real health signal (session success rate, currently above target) and one real continuous signal (hypothesis resolution rate, tracking toward target). Inactive row won't inject.
