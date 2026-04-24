# Lens B — Metric Flow (Build Health)

**Session:** s_1776477761576_779  •  **Date:** 2026-04-18  •  **Lens:** B (Flow Complexity)

## Objective
Trace `tech-lead.build-health` end-to-end: cron `source_command` → DB write → heartbeat injection. Count layers/files and flag polarity inconsistency.

## End-to-End Flow (5 touchpoints, 3 source files)

| # | Layer | File:line | What happens |
|---|-------|-----------|--------------|
| 1 | **Cron schedule** | `agents/may/cron.json:482-490` | `metrics-snapshot` job fires every `intervalMs: 3600000` (1h), offset 180s. |
| 2 | **Command execution** | `agents/may/handlers/metrics-snapshot.ts:399-401` | For each `source='command'` metric, `execSync(m.source_command, …)` runs and `parseFloat`s stdout. |
| 3 | **DB write (snapshot + current)** | `agents/may/handlers/metrics-snapshot.ts:416-421` | `INSERT INTO metric_snapshots …` then `UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?`. |
| 4 | **Threshold alert check** | `agents/may/handlers/metrics-snapshot.ts:187-194` (`checkThresholdAlert`) | `breaching = alertAbove ? value > threshold : value < threshold`. For `build-health`: `alert_direction='below'`, so breach = `value < 1`. |
| 5a | **Heartbeat injection (primary)** | `src/app/cron.ts:689-724` | Per-agent `SELECT … FROM metrics m LEFT JOIN metric_snapshots s …`, formats `- [speed] **name**: val → target: T ⚠️ BELOW THRESHOLD` when `current < threshold`. Writes into cron-built heartbeat message. |
| 5b | **Heartbeat-context file (parallel path)** | `agents/may/handlers/heartbeat-context.ts:370-385` (`getAgentMetrics`) + `:387-401` (`formatMetricsContext`) | Separate query + formatter writes `heartbeat-context.md` into each agent workspace with `**📊 Your Metrics:**` block. Uses the same `current < threshold` rule (`:396`). |

## DB state (ground truth)
Queried via `bun:sqlite` on `.state/may.db`:
```
id=tech-lead.build-health  name="Build health"
current=1  target=0  threshold=1  alert_direction=below
source_command="npm run check > /dev/null 2>&1 && echo 1 || echo 0"
```

## Finding 1 — Duplicate heartbeat injection path (5a vs 5b)

**Two independent implementations** format the same metrics for heartbeat consumption:

- `src/app/cron.ts:691-715` — inline SQL + formatter, injected directly into the per-agent heartbeat message via `injections.push(...)` (`:724`).
- `agents/may/handlers/heartbeat-context.ts:372-385` + `:387-401` — `getAgentMetrics()` / `formatMetricsContext()`, written to `<agent-workspace>/heartbeat-context.md` at `:454-458`.

Both re-implement the same logic:
- Same join shape (`metrics LEFT JOIN metric_snapshots ON MAX(measured_at)`): `cron.ts:693-696` ≈ `heartbeat-context.ts:375-378`.
- Same warn rule (`current < threshold`): `cron.ts:710` and `heartbeat-context.ts:396`.
- Differing output strings and header logic (`cron.ts:717-720` has a "Action rule (not optional)" block; `heartbeat-context.ts:391-399` does not).

**Indirection not earning its keep:** one of the two paths is redundant. Agents receive the metric block once via the injected cron message (5a) and again via the workspace `heartbeat-context.md` (5b), with drift risk as formatters evolve independently.

## Finding 2 — Polarity inconsistency for `build-health` (cosmetic, misleading)

Source command semantics (`cron.json` via DB row): `… && echo 1 || echo 0` → **1 = success, 0 = failure**.

Configured row: `target=0`, `threshold=1`, `alert_direction='below'`.

- Threshold gate (`metrics-snapshot.ts:189`, `cron.ts:710`): `current < threshold` → with `current=1, threshold=1`, `1 < 1 = false` → correctly **not** flagged red.
- But the heartbeat display (`cron.ts:708`: `` ` → target: ${m.target}` ``) renders as **"Build health: 1 → target: 0"**, which reads as "goal is 0; we are at 1" — the opposite of reality for a 1=green metric.

This is the exact misread cited in recent tech-lead session summaries ("build health=1 (red)" — `Last Session` section of this session's context). The threshold math is correct; the **`target=0` field value is wrong** for a 1=success polarity (should be `target=1`, or the command should be flipped to `echo 0 || echo 1` to match a 0=good convention used by other metrics).

Evidence the misread has occurred: `agents/may/workspace/projects/metric-reaction-investigation.md:225` logs `tech-lead.build-health | current=1 | target=0 | threshold=NULL | no reaction` — i.e., the investigator also treated `current=1, target=0` as a non-reacting red.

## Severity
- **Finding 1 (duplicate injection):** medium. Not breaking anything today; risk is silent drift between two formatters. ~30 lines of duplicate logic (`cron.ts:689-725` ≈ 37 lines vs `heartbeat-context.ts:370-401` ≈ 32 lines).
- **Finding 2 (polarity):** low-severity data bug, high-severity UX. Actively confusing tech-lead heartbeats — at least one recorded prior-session misread. One-row DB fix OR one-line `source_command` edit.

## Recommended follow-ups (do NOT fix in this session)
1. **Pick one injection path.** Delete the inline block in `src/app/cron.ts:683-726` and have the cron reader consume the already-generated `heartbeat-context.md`, OR delete the metrics block in `heartbeat-context.ts:448-452` and keep the cron-inline path. Owner: tech-lead dispatch → coder.
2. **Fix `build-health` polarity.** Either:
   - `UPDATE metrics SET target = 1 WHERE id = 'tech-lead.build-health'`, or
   - change `source_command` to `npm run check > /dev/null 2>&1 && echo 0 || echo 1` and keep `target=0` (matches "lower=better" convention shared with `stuck-requests` etc).
   Pick whichever convention the majority of metrics already use (quick `SELECT target FROM metrics WHERE source='command'` survey needed).

## Counts summary
- **Files involved:** 3 (`agents/may/cron.json`, `agents/may/handlers/metrics-snapshot.ts`, `agents/may/handlers/heartbeat-context.ts`) + `src/app/cron.ts` for injection (4 total).
- **Distinct layers:** 5 (schedule → exec → DB write → threshold check → heartbeat inject), with layer 5 implemented **twice**.
- **Duplicate formatter lines:** `cron.ts:689-725` and `heartbeat-context.ts:370-401`.
