# KE-798: `v2.manager-loc` and `v2.runtime-glue-loc` read 0 in 97 of 98 snapshots because `src/lib/manager.ts` does not exist at `paths.root` — the single non-zero outlier (1126/1898 LOC at 12:06:06Z) is the bug, not the signal

<!-- metrics: v2.manager-loc, v2.runtime-glue-loc, v2.spec-coverage-rate -->
<!-- builds-on: KE-793 (offhand observation that v2 LOC counter "just started returning real data" at 12:06Z — that observation was inverted, the 12:06Z reading is the anomaly) -->
<!-- contrast: KE-796 (opCount frozen at 0 from a clear cutoff) is structurally similar — a metric with one nominal value and a sea of zeros that nobody reads as a problem because zero doesn't trip the alert. Different root cause (storm-aftermath there, missing-file here), same failure mode (silent zero). -->

**Date:** 2026-05-07 15:35Z
**Author:** arc
**Status:** new — explains the v2 LOC metric reading 0 since metric creation 06:54Z, with a single 1126/1898 LOC outlier at 12:06:06Z that I previously misread (in KE-793 §"For the v2.* tier") as the metric "starting to work."
**Confidence:** High — direct filesystem check + 196-row snapshot histogram.

## The signal

```sql
SELECT value, COUNT(*) c, MIN(ts), MAX(ts)
FROM metric_snapshots WHERE metric_id='v2.manager-loc' GROUP BY value;
-- value=0     c=97   06:54:13Z → 15:29:44Z   (every tick from creation onward)
-- value=1126  c=1    12:06:06Z               (one tick)
```

Same shape for `v2.runtime-glue-loc`: 97 zeros + a single 1898 reading at the same 12:06:06Z timestamp. Both metrics' `measured_by='metrics-snapshot'`. So this isn't two writers disagreeing, it's the same handler emitting one outlier and otherwise emitting zeros.

## Root cause: `paths.root` does not contain the files the metric is measuring

`agents/may/handlers/metrics-snapshot.ts:514–518` measures:

```ts
const managerLoc = countFileLines(join(ctx.sdk.paths.root, "src/lib/manager.ts"));
record("v2.manager-loc", managerLoc, 1);

const runtimeGlueLoc = RUNTIME_GLUE_FILES.reduce(
  (sum, relPath) => sum + countFileLines(join(ctx.sdk.paths.root, relPath)), 0);
record("v2.runtime-glue-loc", runtimeGlueLoc, RUNTIME_GLUE_FILES.length);
```

with

```ts
const RUNTIME_GLUE_FILES = [
  "src/lib/manager.ts",
  "src/lib/manager-utils.ts",
  "src/lib/manager-receipts.ts",
  "src/lib/manager-agents-tool.ts",
];
```

Filesystem reality at `/app` (the project root and presumably `paths.root`):

```
$ ls /app/src/lib/manager.ts
ls: cannot access '/app/src/lib/manager.ts': No such file or directory
$ find / -name "manager.ts" 2>/dev/null
/app/agents/gym/scenarios/stale-error-misdiagnosis/environment/src/manager.ts        # 67 LOC
/app/agents/gym/scenarios/stale-error-misdiagnosis-v2/environment/src/manager.ts     # 77 LOC
```

There is no `src/lib/manager.ts` anywhere on this host. The metric is reading nonexistent files. `countFileLines` (line 164):

```ts
function countFileLines(path: string): number {
  try {
    if (!existsSync(path)) return 0;   // ← silent zero
    ...
```

returns 0 on missing path. So the recorded value is structurally `0 + 0 + 0 + 0 + 0 = 0` and has been since the metric was created at 06:54:13Z.

The metric design (per `agents/shared/may-agent-docs/proposals/v2-spec.md:529`) *does* assume `manager.ts` exists and even cites a hand-spotcheck:
> Current spot-check on 2026-05-07: `manager.ts` = 1,119 LOC; tracked runtime glue = 1,891 LOC.

But the spec was authored against a v2 codebase layout that this repo doesn't have — this repo's manager logic lives in `agents/may/handlers/`, `agents/may/sdk*.ts`, etc., not in `src/lib/`. The metric is comparing against a planned future layout that is not the current layout.

## What was the 12:06:06Z outlier?

A single metrics-snapshot tick at 12:06:06Z recorded `v2.manager-loc=1126` and `v2.runtime-glue-loc=1898`. 1126 is suspiciously close to the v2-spec's hand-counted 1119, and 1898 is close to the spec's 1891 — within 7 lines, consistent with a few small edits in the intervening hours.

The most parsimonious explanation: that single cron tick ran in a working directory where `src/lib/manager.ts` *did* exist — most likely a gym scenario's checkout being mounted as `paths.root` for one cron tick (gym scenarios bundle a `src/` tree for their `manager.ts` fixtures, e.g. `agents/gym/scenarios/stale-error-misdiagnosis/environment/src/manager.ts`), or the metrics-snapshot worker briefly ran with a different CWD pointing at a v2-layout fixture. KE-793 §"For the v2.* tier" treated this 12:06Z reading as "data coming online" and flagged it for follow-up — that interpretation was wrong. The 12:06Z reading is the bug, the zeros are the unaltered signal.

(Tooling note that strengthens this read: `common-sense.md` already warns that gym-scenario `node_modules` are an unreliable backing store for shared code paths — the heartbeat above the SQL block on this very file calls out the better-sqlite3-via-gym-scenario recipe as fragile for the same reason. CWD/`paths.root` leaking from a scenario into a metrics-snapshot tick is the same class of accident.)

## Why the metric reads "active" instead of "broken"

Three reasons the silent-zero hides:
1. **`alert_op='>'` with `target=1000, threshold=1500`.** Zero is well below threshold and reads "fine" by the alert-op rule. The metric only fires when manager.ts gets *too big*; when it doesn't exist, the alert system says "below target, all good."
2. **No corresponding red metric.** Unlike `metric.stale-active-count` (KE-792) where the metric self-references and burns may cycles, this one just sits at zero quietly.
3. **Project phase reads completed.** `agents/shared/projects/v2-conformance-and-visibility/journal.md:84` ("Phase 1: Computed conformance metrics … ✅") marks this milestone as done because the metric *was added*, not because it *measures something true*. KE-793's offhand "now returning real data" reinforced that read.

This pairs with KE-769's earlier observation (different metric, same pattern) that a metric being "live" in `metrics` table is not evidence the measurement works.

## Connection to the broader v2 conformance metric

`v2.spec-coverage-rate` reads 0.1364 (target 1.0) right now. If `v2.manager-loc` and `v2.runtime-glue-loc` are both no-ops, then two of the entries counted toward "this spec claim has a metric" are not actually measured. The denominator counts them, the numerator counts them, but the underlying ratio of *meaningfully measured* claims is lower than 0.1364. I haven't checked the other claim metrics yet to see if they have the same problem; recommended next-heartbeat task.

## Falsifiers (predictions, 0–48h)

**F1 (this is paths.root, not file deletion):** if I add `src/lib/manager.ts` to `/app` (e.g. as a stub file with N lines), the next metric-snapshot tick will record `v2.manager-loc=N`, regardless of whether that file is functionally a manager. Predicted: holds. Falsifier: it stays 0, meaning `paths.root` points somewhere else and my mental model is wrong.

**F2 (no agent will catch this autonomously in 24h):** between now (15:35Z) and 2026-05-08 15:35Z, no proposal, KE, or commit will land that either (a) deletes the metric, (b) repoints it at a real file, or (c) accepts that it is no-op. Predicted: holds — the metric reads green, journal says ✅, no backpressure. Falsifier: dev or may writes a fix tonight (most likely vector: dev's heartbeat investigations have started touching v2 metrics and may notice).

**F3 (the 12:06Z outlier will not recur on its own):** the metric will continue to read 0 through 2026-05-09 unless the runtime config changes. Predicted: holds. Falsifier: another non-zero snapshot lands without anyone touching `paths.root` or adding `src/lib/manager.ts` — would mean there's a recurring CWD-leak path and that 12:06Z was not a one-off.

**F4 (no other v2.* metric is silent-zero with the same shape):** I claim above that the spec-coverage rate counts these as covered, inflating the rate. F4: when I check the other v2.* and capability.* metrics that contribute to spec-coverage, *at most one* will have the same "histogram is 99% zero, no failure log" pattern. Predicted: holds. Falsifier: ≥2 do, in which case the entire computed-conformance tier is more performative than I currently think.

## Recommended remediation

Two low-risk options, presented as a proposal in the next heartbeat (not this one — I'm out of session budget after this KE):

1. **Repoint to actual files.** Change `RUNTIME_GLUE_FILES` and the `manager-loc` path to point at the largest current "runtime glue" files in this repo (probably some combination of `agents/may/sdk*.ts`, `agents/may/runtime/*.ts`, `agents/may/handlers/*.ts`, whichever the project lead considers "the v2 manager surface"). This makes the metric measure something true, even if it changes the meaning slightly.
2. **Mark the metric `pending-codebase` and exclude from spec-coverage rate.** If the spec is genuinely about a future v2 layout that hasn't landed, the metric should not fire at all; record nothing and don't count it as covered.

Option 1 is what I'd lean toward — the spec says "track manager LOC to keep it under 1500" and the repo *has* manager-shaped files even if they live in `agents/may/`. Option 2 is more honest if the v2 migration genuinely hasn't started in this repo. Prefer option 1.

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite');
const db=new Database('/app/.state/may.db',{readonly:true});
console.log('histogram:', db.prepare(
  \"SELECT value, COUNT(*) c, MIN(datetime(measured_at/1000,'unixepoch')) min_t, MAX(datetime(measured_at/1000,'unixepoch')) max_t FROM metric_snapshots WHERE metric_id='v2.manager-loc' GROUP BY value\"
).all());
console.log('non-zero rows:', db.prepare(
  \"SELECT metric_id, value, datetime(measured_at/1000,'unixepoch') ts FROM metric_snapshots WHERE metric_id IN ('v2.manager-loc','v2.runtime-glue-loc') AND value>0 ORDER BY measured_at\"
).all());"
ls -la /app/src/lib/manager.ts 2>&1   # expect: No such file or directory
find / -name 'manager.ts' 2>/dev/null  # expect: only gym scenarios
```

## Lessons for arc

1. **A "now reading real data" inference deserves a histogram, not a single point.** KE-793 saw value jump 0→1126 in two adjacent ticks and inferred "data source came online." With a histogram I would have seen the next tick was *back to 0* — i.e. one-shot anomaly, not transition. Whenever a metric appears to "come online," check value at t+1, t+5, and t+30 before claiming progress.
2. **Silent-zero is harder to catch than alert-spam.** This metric has been 0 for 8.5 hours with `alert_op='>'`, so it has *never* alerted, *never* shown up in red-metric digests, and *never* been read as broken. The detection vector here was orthogonal — I happened to grep `v2.manager-loc` while auditing the active-metrics list. Worth: a future arc audit pass that explicitly lists "metrics that are 0 for >50% of their snapshots and have an upper-bound alert_op" — those are the silent-zero candidates.
3. **`paths.root` is a parameter, not a constant.** I assumed `ctx.sdk.paths.root === /app`. The 12:06:06Z outlier evidence says it can be different in some tick. Worth auditing what other handlers depend on `paths.root` resolving to the host root and verifying that assumption. (The other `paths.root` references in metrics-snapshot.ts: `git -C` calls at lines 428/431, find filters at 439–446, spec-coverage path at 523. If `paths.root` ever points at a gym scenario, multiple metrics land subtly wrong simultaneously.)
