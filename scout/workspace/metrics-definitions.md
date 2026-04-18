# Scout — Metrics Definitions

**Last refined:** 2026-04-18 (see `agents/scout/scripts/refine-metrics-2026-04-18.ts`)

One-pass response to `/tmp/own-your-metrics.md`. All three metrics kept with
real collectors and meaningful targets; zero deactivations.

## Table

| metric | fate | target | threshold | direction | how measured |
|---|---|---|---|---|---|
| `scout.hypotheses-generated` → "CRs produced (7d)" | **collect** | 5 / 7d | — | higher is better | `agents/scout/scripts/measure-hypotheses-generated.sh` — counts `cr[0-9]*.md` files under `agents/scout/workspace/` with `mtime < 7d` |
| `scout.findings-used` → "Findings cited downstream" | **collect** | 0.50 | — | higher is better | `agents/scout/scripts/measure-findings-used.sh` — fraction of scout's `dd*/cr*.md` IDs referenced anywhere under `agents/shared/knowledge/` |
| `scout.coverage` → "Heartbeat coverage (sessions/24h)" | **keep** | 24 / 24h | 12 | higher is better | pre-existing SQL: `SELECT COUNT(*) FROM sessions WHERE agent='scout' AND startedAt > now-24h` |

## Rationale per metric

### 1. scout.hypotheses-generated → CRs produced (7d)
Description was "Am I synthesizing, not just summarizing?" Counting DDs would
reward summarizing (one DD = one source, no synthesis). Counting CRs
(cross-references) matches the intent: a CR binds ≥2 DDs into a thesis.
- **Target 5/7d**: roughly one synthesis per working day. Above this, I'm
  landing theses; below this, I'm hoarding DDs.
- **Baseline 2026-04-18**: 8 (CR-306, CR-311, CR-312, CR-325, CR-335, CR-339,
  CR-340, CR-309). Above target — healthy.
- **No health threshold**: continuous metric, action-at-a-level would be
  arbitrary. Drift tracked via snapshots.

### 2. scout.findings-used → Findings cited downstream (ratio)
Description was "Is my research actionable?" Clean proxy: if my output is
consumed by Bob/Coach/tech-lead, my IDs (DD-NNN / CR-NNN) show up in their
hypotheses, experiments, findings, or synthesis files. If my work only lives
in `agents/scout/workspace/`, nobody reads it.
- **Target 0.50**: half of output should get cited eventually. Stretch but
  achievable (weekend CRs like CR-325/CR-335 landed within days).
- **Baseline 2026-04-18**: 0.3125 (10 / 32). Below target — real signal that
  older workspace-only DDs need promotion or archival.
- **No health threshold**: continuous; directional drift matters more than
  level.

### 3. scout.coverage → Heartbeat coverage (sessions/24h)
SQL collector already worked (source='auto', source_query set). Only the
semantics were broken: target=0 made the metric nonsensical.
- **Target 24/24h**: one session per heartbeat-hour is the design baseline.
- **Threshold 12/24h**: half of target. Below this means heartbeat cron or
  auto-resume is failing — fork an investigation.
- **`current=55`**: reflects deliberate double-cadence (30-min heartbeats)
  during weekend monitoring. Above threshold, so no alert; not an anomaly.
- **`alert_direction='below'`** already correct.

## Files

- `agents/scout/scripts/refine-metrics-2026-04-18.ts` — idempotent DB-row updater
- `agents/scout/scripts/measure-hypotheses-generated.sh` — collector for #1
- `agents/scout/scripts/measure-findings-used.sh` — collector for #2
- this file

## Re-run

```bash
bun agents/scout/scripts/refine-metrics-2026-04-18.ts
```

Collectors auto-run via `metrics-snapshot` handler (source='command' path,
see `agents/may/handlers/metrics-snapshot.ts`). Manual trigger:

```bash
agents/scout/scripts/measure-hypotheses-generated.sh
agents/scout/scripts/measure-findings-used.sh
```

## Reporting

Report back to `s_1776336175530_25`:
- **Fates:** collect, collect, keep (no deactivations)
- **Commit:** see git log after this commit
- **Open questions for Hao:** none — all three metrics have concrete
  collectors and defensible targets.
