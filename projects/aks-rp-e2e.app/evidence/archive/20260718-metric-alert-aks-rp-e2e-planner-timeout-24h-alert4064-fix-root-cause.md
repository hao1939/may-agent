# Metric alert judgment — `aks-rp-e2e.planner.timeout-24h` (alert 4064)

## Decision
- Operation: `fix_root_cause`
- Judged at: `2026-07-18T16:59:00Z`
- Metric owner: `app-ops`
- Alert id: `4064`

## Baseline
Before the repair, the live source command still returned a breach:

- `bun scripts/project-metrics.ts aks-rp-e2e.planner.timeout-24h --json`
- baseline output: `{"measuredAt":1784408288957,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":2}`

Fresh contributor scan showed the two current counted rows were:

1. `2026-07-17T21:34:44.978Z`
2. `2026-07-18T16:06:37.059Z`

Both rows persisted planner-run summary text `Agent step "app-ops" timed out after 360000ms`.

## Root cause
The metric implementation in `scripts/project-metrics.ts` classified planner timeouts by string-matching planner-run summary text only:

- `plannerTimedOut(run)` returned true when `run.result` contained `timed out after`

That misclassified interrupted planning-update sessions as timeouts whenever the planner-run summary kept timeout-shaped text. Current runtime evidence showed those contributors were interrupted planner sessions ending with provider/runtime-style errors such as:

- `OpenAI Responses stream ended before a terminal response event`

So the alert was real at the surface but caused by timeout misclassification, not by current real planner app-ops timeouts.

## Applied repair
Updated `scripts/project-metrics.ts` so timeout classification now:

1. reads matching `s_project_planner_planning_update_*` session `meta.json` / `result.json` records from `.state/sessions/`
2. matches each timeout-shaped planner wake to the nearest planning-update session by end time
3. counts a timeout only when the matched planning-update session actually ended as a timeout/error
4. excludes interrupted/aborted provider-stream failures from the timeout metric
5. lets those interrupted owner-step wakes remain visible to `aks-rp-e2e.planner.slow-count-24h`

Added regression coverage in `scripts/project-metrics.test.ts` for the exact misclassification shape: one interrupted timeout-shaped summary plus one real timeout.

## Verification
Post-repair direct recompute now returns `0`:

- `bun scripts/project-metrics.ts aks-rp-e2e.planner.timeout-24h --json`
- repaired output: `{"measuredAt":1784408360113,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}`

Targeted regression tests passed:

- `bun test scripts/project-metrics.test.ts --test-name-pattern "counts owner-step timeout wakes separately from non-timeout slow wakes|uses matched planning-update session results to exclude interrupted timeout-shaped summaries"`
- result: `2 pass, 0 fail`

## Next validation
Primary validation signal: next `metrics-snapshot` after this commit should update the runtime `metrics.current` row for `aks-rp-e2e.planner.timeout-24h` from the stale `2` to `0` if no new real planner timeout lands first.
