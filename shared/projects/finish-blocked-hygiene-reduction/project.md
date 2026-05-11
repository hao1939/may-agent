---
id: finish-blocked-hygiene-reduction
owner: dev
status: paused
type: milestone
priority: P1
workflow: project
iteration: 6
stop_reason: Split metrics are registered and calibrated; the strict unresolved metric is healthy and the prior P1 alert recovered.
resume_condition: Resume if `session.finish-blocked-unresolved-count-24h` breaches again, or if raw finish-block friction rises with a new unresolved source pattern.
---

# Finish-Blocked Hygiene Reduction

## Goal

Reduce sessions that reach `finish()` with uncommitted/dirty worktree changes, because this is now the largest live driver of broad evaluator low-quality classifications and a recurring source of workflow friction.

## Signals

- Dev heartbeat investigation `agents/dev/workspace/investigations/2026-05-09-evaluator-low-quality-driver-refresh.md` found `uncommitted_changes` was the largest 24h broad low-quality bucket at 179/629 evaluated sessions.
- Fresh heartbeat validation found the finish/uncommitted signature at 233 evaluations in the last 24h.
- Current top sources for the signature are `workflow:scout-heartbeat` (53), `closed-loop-steward` (41), `workflow:may-heartbeat` (32), `workflow:metric-alert-triage` (28), `workflow:project` (27), and `workflow:dev-heartbeat` (21).
- `evaluator.low-quality-rate-24h=0.7472` remains high as a dashboard/friction metric, while `evaluator.substantive-low-quality-rate-24h=0.1447` is much lower; this project targets the hygiene/friction gap rather than hiding it.

## Current State
Paused/monitoring: May registered both split metrics, then calibrated the strict unresolved metric to exclude terminal auto-resume digests whose action is `nothing` with `No recoverable work worth resuming`. The prior P1 alert recovered after the next metrics snapshot (`session.finish-blocked-unresolved-count-24h=0`). The raw P2 alert `session.finish-blocked-uncommitted-count-24h` is a documented monitoring exception while the paired strict unresolved metric stays at `0` and raw-row classification shows only repaired or terminal-no-recovery exits. Resume this project only if the strict unresolved metric breaches again, or raw finish-block friction reveals a new non-recovered source pattern that needs workflow or prompt repair.

## Plan

1. **Reproduce the fresh residual sources**: sample recent `workflow:scout-explore`, `workflow:scout-heartbeat`, `closed-loop-steward`, and `workflow:dev-heartbeat` transcripts with post-`c052855aa` finish/uncommitted `needs_improvement` verdicts to identify whether dirty paths are intentional deliverables, generated runtime files, or unrelated ambient state.
2. **Patch the highest-leverage source**: update the relevant workflow/handler/guard prompt to give exact safe next actions for dirty files, preserving the rule to avoid broad `git add` and not stage unrelated agent work.
3. **Add or propose tracking**: if the runtime metric registry is accessible through the safe event/write path, register a `session.finish-blocked-uncommitted-count-24h` metric; otherwise keep the SQL in this project as the validation query.
4. **Validate reduction**: compare the 24h finish/uncommitted count and top-source distribution before and after the first patch.

## Validation

Use this read-only validation query:

```sql
SELECT COUNT(*) AS n
FROM evaluations e
JOIN sessions s ON s.sessionId = e.sessionId
WHERE e.createdAt > (unixepoch()*1000 - 86400000)
  AND e.issues LIKE '%finish%uncommitted%';
```

Source attribution:

```sql
SELECT s.source, COUNT(*) AS n
FROM evaluations e
JOIN sessions s ON s.sessionId = e.sessionId
WHERE e.createdAt > (unixepoch()*1000 - 86400000)
  AND e.issues LIKE '%finish%uncommitted%'
GROUP BY s.source
ORDER BY n DESC
LIMIT 10;
```

Initial baseline from 2026-05-09 heartbeat: total `233`; top sources `workflow:scout-heartbeat=53`, `closed-loop-steward=41`, `workflow:may-heartbeat=32`, `workflow:metric-alert-triage=28`, `workflow:project=27`, `workflow:dev-heartbeat=21`.

## Journal

### 2026-05-09 — Opened from dev heartbeat

Opened because routine heartbeat evidence showed healthy handlers and no dev-owned alerts, but the prior substantive driver refresh plus fresh DB validation identified a durable cross-workflow reliability problem. The next concrete action is transcript sampling for the top sources, then a narrow workflow/guard prompt patch rather than more evaluator calibration.

### 2026-05-09 — Post-patch heartbeat validation

Validated the first finish-hygiene patch after commit `99c94af88`. The shared heartbeat/project/metric-alert-triage prompts now include explicit read-back, dirty-state classification, narrow staging, and clean-status evidence requirements, but the evaluator's 24h signature still reads `237` sessions (`workflow:scout-heartbeat=56`, `closed-loop-steward=40`, `workflow:may-heartbeat=33`, `workflow:metric-alert-triage=29`, `workflow:project=25`, `workflow:dev-heartbeat=22`). A 1h slice shows 7 fresh routed cases, led by `workflow:scout-heartbeat=3`; next validation should sample fresh scout-heartbeat and closed-loop-steward transcripts after the shared prompt change has had time to propagate, then patch any source-specific closeout path that bypasses the shared hygiene block.

### 2026-05-09 — Ignored shared-project path friction patch

Sampled fresh aftermath artifacts and found a recurring sub-pattern: agents create or update canonical `agents/shared/projects/...` deliverables, then normal `git add` fails because `/shared/projects/` is ignored in the agents repo. One scout session reported a missing project deliverable after `git add` failed; another project workflow iteration self-repaired only after using `git add -f`. Patched the shared heartbeat, metric-alert-triage, and project worker finish-hygiene prompts to explicitly allow `git add -f <exact path>` for intentional deliverables under the ignored canonical `shared/projects/` tree while preserving the ban on broad staging. Fresh validation at patch time: 24h signature `234`; 1h slice `scout-heartbeat=2`, `metric-alert-triage=1`, `may-heartbeat=1`, `goal-driver=1`, `dev-heartbeat=1`.

### 2026-05-09 — Finish deliverable path alias patch

Acted on evaluator FYI for arc session `s_1778334807559_0`: after real commits, finish rejected deliverables reported as `arc/heartbeat.md` and `shared/.../KE-922...` even though those files existed under `/app/agents`. The guard expected `/app`-relative paths only, while agents often reason from the `/app/agents` repo root. Patched `validateFinishDeliverables()` to accept repo-relative aliases when `/app/agents/<first-segment>` exists, so `shared/projects/...` and agent-root paths resolve consistently without weakening missing-file detection. Fresh validation before patch: 24h finish/uncommitted signature `235`; top sources still `scout-heartbeat=56`, `closed-loop-steward=40`, `may-heartbeat=33`, `metric-alert-triage=28`, `project=24`, `dev-heartbeat=22`.

### 2026-05-09 — Heartbeat validation after prompt/guard patches

Heartbeat validation found the broad 24h signature still noisy at `236` finish/uncommitted evaluations, with top sources `scout-heartbeat=56`, `closed-loop-steward=39`, `may-heartbeat=33`, `metric-alert-triage=28`, `project=25`, `dev-heartbeat=23`, and `orchestrator=17`. A 1h slice showed only three fresh cases: a dev heartbeat that shipped the finish-guard alias fix but closed partial on ambient dirty state, a dev project iteration whose deep eval judged the prompt patches as real value despite noisy 24h movement, and the arc alias-friction case that the guard patch already addressed. Decision: no new prompt patch this heartbeat; continue to watch the 1h slice after propagation, with special attention to ambient shared worktree dirt versus true uncommitted intentional deliverables.

### 2026-05-09 — Iteration 3 closeout validation

Post-classifier-patch validation shows the remaining fresh finish/uncommitted signal is no longer an evaluator low-quality misclassification driver. The 24h raw signature is still `235` while old rows roll off, but the post-`c052855aa` slice contains exactly one row (`s_1778339078795_14`, `workflow:project`) and it routed `verdict=good` with `session.status=done` and `session.outcome=done`. Moved the project to `pending-review` instead of patching again; resume only if fresh post-patch rows route `needs_improvement` or show unresolved dirty exits.

### 2026-05-09 — Reopened from heartbeat residual validation

Heartbeat validation found the pending-review resume condition is now met: since evaluator classifier commit `c052855aa`, finish/uncommitted evaluations include 23 rows, with 18 `good` and 5 still routing `needs_improvement`. The residual cases are `workflow:scout-explore` (`s_1778356268434_217`, `s_1778348168426_122`), `workflow:dev-heartbeat` (`s_1778343965279_64`), `workflow:scout-heartbeat` (`s_1778340111148_0`), and `closed-loop-steward` (`s_1778340047294_1`). Reopened to `active` for iteration 4; next work should sample those transcripts and patch the highest-leverage source-specific closeout path or evaluator override rule.

### 2026-05-09 — Preserve acceptable review verdicts

Heartbeat sampling showed the residual finish/uncommitted `needs_improvement` bucket is partly a classifier artifact: repaired sessions reviewed as `acceptable` were forcibly remapped to `needs_improvement`, even though the review text said the session shipped real output with weaker quality. Patched `evaluator-aftermath` so review overrides preserve `acceptable` as the stored verdict/event value while still lowering quality to `0.65`; true `needs_improvement` reviews remain downgraded. Fresh validation before patch: 24h raw finish/uncommitted signature `208`, with `187 needs_improvement`, `20 good`, and `1 acceptable`; the 1h slice had two residual needs-improvement rows, one reviewed `acceptable` and one true `needs_improvement`.

### 2026-05-10 — Blocked-state heartbeat response

Responded to May's P2 blocked-project nudge during dev heartbeat. The project remains correctly `blocked` rather than `waiting`: the remaining action is not time-based or owner-local work, but a safe runtime DB write by May/human to register `session.finish-blocked-uncommitted-count-24h` and `session.finish-blocked-unresolved-count-24h`. Fresh read-only validation still finds neither metric in `metrics`; no more sampling or prompt patches are indicated until the exact registration packet in `outputs/iteration-6-split-metric-registration.md` is applied and snapshots exist.

### 2026-05-10 — P1 blocked-project nudge recheck

Responded to May's newer P1 nudge asking dev to unblock/close this project and address `project.iterations-24h=0`. Read-only heartbeat validation again found the two required split metrics absent from `metrics`, so dev still cannot safely unblock or close the project without the May/human runtime write named in `resume_condition`; the correct operation is escalate/hold blocked, not create artificial project iterations or hide the blocker. The separate `eval-llm-lane-restoration` project remains healthy in pending-review: `eval.llm-coverage-lag-h=0.02`, `eval.llm-evals-24h=30`, and the latest non-heuristic evaluation is `2026-05-10 07:25:55` UTC.

### 2026-05-10 — Heartbeat blocked-state hold

Handled the repeated blocked-project nudge during heartbeat. Fresh read-only validation still found no metric rows for `session.finish-blocked-uncommitted-count-24h` or `session.finish-blocked-unresolved-count-24h`; `project.iterations-24h` is open but May-owned, and creating synthetic work would game that metric rather than resolve the safe-write blocker. The project remains correctly `blocked` until May/human applies the exact idempotent registration packet from `outputs/iteration-6-split-metric-registration.md` and confirms fresh snapshots.

### 2026-05-10 — Heartbeat message recheck and blocker restated

Dispositioned May's P2 blocker question again with fresh evidence rather than changing status: the split metric rows are still absent from `metrics`, while the exact registration packet remains available in `outputs/iteration-6-split-metric-registration.md`. The live source-query values have improved to raw_24h=52 and strict_unresolved_24h=0, but registration still requires a safe runtime DB write by May/human before this project can leave `blocked`.

### 2026-05-11 — Metric alert waiting evidence recheck

Rechecked alert `session.finish-blocked-unresolved-count-24h` after the first triage session. The live metric still reads `current=1` with three consecutive snapshots at `1`, and the only strict unresolved row remains historical interrupted May closed-loop-steward session `s_1778432730435_1172` (`issues=["terminal status: interrupted","finish blocked by uncommitted changes"]`, no successful/partial digest). The project remains paused with no new patch indicated; validate on the next metrics snapshot after the historical row ages out of the 24h window, or resume immediately if a newer strict unresolved row appears.

### 2026-05-11 — Repeated alert waiting_with_evidence judgment

Rechecked repeated alert 284 after the process restart. The live metric row still reports `current=1`, the latest six snapshots all remain `1`, and the strict source query still returns exactly one row: historical May `closed-loop-steward` session `s_1778432730435_1172` with `status=interrupted`, `outcome=interrupted`, and issues `["terminal status: interrupted","finish blocked by uncommitted changes"]`. Chosen operation: `waiting_with_evidence`, because the breach is real but already explained by the pre-existing 24h row; no safe owner-local fix exists except waiting for the strict 24h window to age it out, while any newer strict unresolved row should immediately resume the project.

### 2026-05-11 — Alert 284 latest waiting_with_evidence recheck

Rechecked alert 284 again during metric-alert triage. The metric row remains `current=1`, `threshold=0`, `target=0`, priority `P1`, with eight consecutive snapshots at `1`. The strict source query still returns exactly one unresolved row: May `closed-loop-steward` session `s_1778432730435_1172`, evaluated at `2026-05-10T17:15:51.009Z` with `status=interrupted`, `outcome=interrupted`, no success/partial digest, and issues `["terminal status: interrupted","finish blocked by uncommitted changes"]`. Chosen operation: `waiting_with_evidence`; no new root-cause patch or escalation is indicated because the row is historical and should leave the 24h strict window on the next metrics snapshot after `2026-05-11T17:15:51.009Z`, while any newer strict unresolved row should resume this paused project immediately.

### 2026-05-11 — Alert 284 repeated waiting_with_evidence hold

Rechecked alert 284 after another P1 metric-alert triage trigger. The metric row still reads `current=1`, `threshold=0`, `target=0`, priority `P1`, and the latest ten snapshots all remain `1`; the strict source query still returns exactly one row, May `closed-loop-steward` session `s_1778432730435_1172`, evaluated at `2026-05-10T17:15:51.009Z` with `status=interrupted`, `outcome=interrupted`, no success/partial digest, and issues `["terminal status: interrupted","finish blocked by uncommitted changes"]`. Chosen operation: `waiting_with_evidence`; this is an accepted wait on the strict 24h window rather than a new root-cause fix, calibration, downgrade, or escalation. Next validation remains the first metrics snapshot after `2026-05-11T17:15:51.009Z`, or immediate project resume if any newer strict unresolved row appears.

### 2026-05-11 — Strict metric calibration and alert recovery

Manual review found the repeated P1 alert was a metric calibration bug, not a live unresolved dirty exit. The only counted row had a latest auto-resume digest with `action=nothing` and `action_reason=No recoverable work worth resuming`, so the recovery process had already made a terminal judgment. Updated the strict metric source query to exclude that terminal no-recovery digest shape while keeping the raw friction metric unchanged. The next metrics snapshot set `session.finish-blocked-unresolved-count-24h=0`, emitted `metric.recovered`, and resolved alert 284.

### 2026-05-11 — Raw metric alert 287 waiting_with_evidence judgment

Triaged P2 alert `session.finish-blocked-uncommitted-count-24h` after the raw count moved from 50 to 51. The breach is real, but the paired strict unresolved metric is healthy (`current=0` with the latest ten snapshots at `0`), and recent raw rows are dominated by repaired/accepted exits: latest samples show `status=done`, `outcome=done`, and `digest_outcome=success`, while the one fresh interrupted scout-heartbeat row has `action=nothing` / `No recoverable work worth resuming`. Chosen operation: `waiting_with_evidence`; keep the project paused unless the strict unresolved metric breaches again or a newer raw slice shows a non-recovered source pattern rather than repaired finish-block friction.

### 2026-05-11 — Alert 287 repeated waiting_with_evidence hold

Rechecked P2 raw metric alert 287 after the latest snapshot rose to `52` over threshold `50`. The breach is still real, but paired strict unresolved metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0`; the raw 24h slice contains `52` finish-blocked evaluations, of which `49` are repaired successful exits (`session.status=done`, `outcome=done`, latest digest `success`), `2` are interrupted rows already marked `action=nothing` / `No recoverable work worth resuming`, and the residual top sources remain repaired scout/may/steward heartbeat friction rather than a new unresolved dirty-exit pattern. Chosen operation: `waiting_with_evidence`; keep this project paused/monitoring and validate on the next metrics snapshot, resuming only if the strict unresolved metric breaches or the raw slice exposes a newer non-recovered source pattern.

### 2026-05-11 — Alert 287 third waiting_with_evidence hold

Rechecked P2 raw metric alert 287 after the latest snapshot rose again to `53` over threshold `50`. The breach is real raw finish-block friction, but the paired strict unresolved metric remains healthy at `current=0` with ten consecutive zero snapshots. The current raw slice has `53` finish-blocked evaluations: `50` repaired successful exits (`session.status=done`, `outcome=done`, latest digest `success`), `2` interrupted rows already classified `action=nothing` / `No recoverable work worth resuming`, and `1` historical Arc heartbeat partial that still completed `status=done`/`outcome=done`, evaluated `good`, and documented a verifier-state leak rather than uncommitted deliverables needing recovery. Chosen operation: `waiting_with_evidence`; keep this project paused/monitoring and validate on the next metrics snapshot, resuming only if the strict unresolved metric breaches or a newer raw slice exposes a non-recovered source pattern.

### 2026-05-11 — Alert 287 fourth waiting_with_evidence hold

Rechecked P2 raw metric alert 287 after the latest snapshots reached `54` over threshold `50`. The breach remains real raw finish-block friction, but paired strict metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` and recent raw attribution still shows repaired exits: `49` rows are `status=done`/`outcome=done` with latest digest `success`, `2` interrupted rows are already classified `action=nothing` / `No recoverable work worth resuming`, and the remaining repaired rows include `1` partial digest and source-level successful completions. Latest rows are mainly successful scout/may/steward workflow exits, with the newest may/steward rows additionally flagged for committed runtime handoff files rather than unrecovered source deliverables. Chosen operation: `waiting_with_evidence`; keep the project paused/monitoring, do not calibrate or resolve a still-breaching raw metric, and resume only if the strict unresolved metric breaches or raw sampling exposes a fresh non-recovered pattern.

### 2026-05-11 — Alert 287 latest waiting_with_evidence recheck

Rechecked P2 raw metric alert 287 after the latest snapshots held at `54` over threshold `50`. The raw breach remains real, but the paired strict unresolved metric is still healthy at `current=0` with ten consecutive zero snapshots. The current raw 24h slice has `54` finish-blocked evaluations: `51` repaired successful exits (`session.status=done`, `outcome=done`, latest digest `success`), `1` repaired partial digest, `2` interrupted rows already classified `action=nothing` / `No recoverable work worth resuming`, and `0` other unresolved rows. Chosen operation: `waiting_with_evidence`; keep the project paused/monitoring and validate at the next metrics snapshot, resuming only if the strict unresolved metric breaches or raw sampling exposes a new non-recovered source pattern.

### 2026-05-11 — Alert 287 repeated raw-friction hold at 54

Rechecked P2 raw metric alert 287 after the metric continued to hold at `54` over threshold `50`. The latest paired strict metric row remains healthy (`session.finish-blocked-unresolved-count-24h current=0`) with recent snapshots alternating raw `54` and strict `0`; the current raw 24h slice still classifies all `54` rows as recovered or intentionally terminal: `51` repaired successful exits, `1` repaired partial digest, `2` interrupted rows with `action=nothing` / `No recoverable work worth resuming`, and `0` other unresolved rows. Chosen operation: `waiting_with_evidence`; the raw breach is accepted as monitoring friction for now, with no root-cause patch or calibration indicated unless the strict unresolved metric breaches or a fresh raw sample shows a non-recovered source pattern.

### 2026-05-11 — Alert 287 repeated raw-friction hold at 55

Rechecked P2 raw metric alert 287 after the latest snapshot eased from `56` to `55` but still breached threshold `50`. The paired strict unresolved metric remains healthy (`session.finish-blocked-unresolved-count-24h current=0`) with the latest ten strict snapshots at `0`; the current raw 24h slice classifies all `55` rows as recovered or intentionally terminal: `52` repaired successful exits (`session.status=done`, `outcome=done`, latest digest `success`), `1` repaired partial digest, and `2` interrupted rows already marked `action=nothing` / `No recoverable work worth resuming`. Chosen operation: `waiting_with_evidence`; keep the project paused/monitoring and validate at the next metrics snapshot, resuming only if the strict unresolved metric breaches or raw sampling exposes a new non-recovered source pattern.

### 2026-05-11 — Alert 287 owner recheck at 55

Rechecked P2 raw metric alert 287 in the later owner triage session. The metric row still reports `current=55`, `threshold=50`, `target=0`, and open alert `287`, while paired strict unresolved metric `session.finish-blocked-unresolved-count-24h` remains `current=0` with ten consecutive zero snapshots. Source attribution still shows no unresolved raw rows: the live raw 24h classification query found `52` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases; top sources are repaired scout/steward/may/arc workflow exits. Chosen operation: `waiting_with_evidence`; no calibration, manual resolve, root-cause patch, or escalation is indicated unless the strict metric breaches or a future raw sample exposes a new non-recovered source pattern.

### 2026-05-11 — Alert 287 waiting_with_evidence at 57

Rechecked P2 raw metric alert 287 after the latest snapshot reached `57` over threshold `50`. The raw breach is real and still open, but the paired strict unresolved metric remains healthy at `current=0` with ten consecutive zero snapshots. The live raw 24h classification query found all `57` rows recovered or intentionally terminal: `54` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases; source attribution remains repaired scout/steward/may workflow friction rather than a fresh non-recovered dirty-exit pattern. Chosen operation: `waiting_with_evidence`; keep the project paused/monitoring and validate on the next metrics snapshot, resuming only if the strict unresolved metric breaches or raw sampling exposes a new non-recovered source pattern.

### 2026-05-11 — Alert 287 repeated waiting_with_evidence at 57

Rechecked P2 raw metric alert 287 in the next triage session. The metric row still reads `current=57`, `threshold=50`, `target=0`, priority `P2`, with alert 287 unresolved, while the paired strict unresolved metric remains healthy at `current=0` and the latest ten paired snapshots show strict `0` alongside raw `56–58`. The live raw 24h classification query again found no unresolved dirty exits: `54` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases; the latest raw rows are successful scout/explore/steward/may completions plus one already terminal no-recovery scout interruption. Chosen operation: `waiting_with_evidence`; this keeps the project paused/monitoring rather than calibrating or resolving a still-breaching raw friction metric, with next validation on the next metrics snapshot or immediate project resume if the strict metric breaches/new raw sampling exposes a non-recovered pattern.

### 2026-05-11 — Alert 287 waiting_with_evidence at 58

Rechecked P2 raw metric alert 287 after the latest raw snapshot reached `58` over threshold `50`. The breach is real and the alert remains open, but the paired strict unresolved metric remains healthy at `current=0` with the latest ten paired snapshots showing strict `0` while raw fluctuates `57–58`; the live raw 24h classification query found all `58` rows recovered or intentionally terminal: `55` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases. Chosen operation: `waiting_with_evidence`; keep the project paused/monitoring rather than calibrating or resolving a still-breaching raw friction metric, with next validation on the next metrics snapshot or immediate project resume if the strict metric breaches or raw sampling exposes a new non-recovered pattern.

### 2026-05-11 — Alert 287 waiting_with_evidence recheck at 58

Rechecked P2 raw metric alert 287 after another owner triage. The raw metric row still reports `current=58`, `threshold=50`, `target=0`, priority `P2`, and alert `287` remains unresolved; recent snapshots hold at `57–58`. The paired strict unresolved metric remains healthy at `current=0` with ten consecutive zero snapshots. The live raw 24h classification query again found no unresolved dirty exits: `55` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases; top sources remain repaired scout/steward/may workflow friction. Chosen operation: `waiting_with_evidence`; this is a deliberate monitoring hold, not a root-cause patch, calibration, downgrade, manual resolve, or escalation. Next validation is the next metrics snapshot, or immediate project resume if the strict metric breaches or raw sampling exposes a new non-recovered source pattern.

### 2026-05-11 — Alert 287 waiting_with_evidence hold with strict metric healthy

Rechecked P2 raw metric alert 287 after the latest snapshots held at `58` above threshold `50`. The raw breach is real and remains open, but the paired strict unresolved metric still reads `current=0` with ten consecutive zero snapshots; the live raw 24h classification query found all `58` rows recovered or intentionally terminal: `55` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases. Chosen operation: `waiting_with_evidence`; keep this project paused/monitoring, do not calibrate or manually resolve the still-breaching raw friction metric, and validate at the next metrics snapshot or resume immediately if the strict unresolved metric breaches or raw sampling exposes a fresh non-recovered source pattern.

### 2026-05-11 — Alert 287 repeated waiting_with_evidence hold at 58

Rechecked P2 raw metric alert 287 after the latest snapshots again held at `58` over threshold `50`. The raw breach is real, but paired strict unresolved metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` with ten consecutive zero snapshots. Fresh raw classification found all `58` rows recovered or intentionally terminal: `55` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases; source attribution remains repaired scout/steward/may workflow friction rather than a new unresolved dirty-exit pattern. Chosen operation: `waiting_with_evidence`; this is a deliberate monitoring hold, with validation at the next metrics snapshot or immediate project resume if the strict metric breaches or raw sampling exposes a fresh non-recovered source pattern.

### 2026-05-11 — Alert 287 waiting_with_evidence hold after repeated 58 snapshots

Rechecked P2 raw metric alert 287 after the latest metric row and snapshots continued to hold at `58` over threshold `50`. The raw breach is real and the alert remains unresolved, but the paired strict unresolved metric remains healthy at `current=0` with ten consecutive zero snapshots. Fresh classification of the live raw 24h slice again found every row recovered or intentionally terminal: `55` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases; recent rows and source attribution remain repaired scout/steward/may workflow friction rather than a new unrecovered dirty-exit pattern. Chosen operation: `waiting_with_evidence`; this deliberately accepts continued monitoring without calibrating or resolving the still-breaching raw metric, with validation at the next metrics snapshot or immediate project resume if the strict metric breaches or raw sampling exposes a fresh non-recovered source pattern.

### 2026-05-11 — Alert 287 waiting_with_evidence at 58 with no unresolved exits

Rechecked P2 raw metric alert 287 after the latest metric row still reported `current=58`, `threshold=50`, `target=0`, priority `P2`, and alert `287` unresolved. The breach is real raw finish-block friction, but the paired strict unresolved metric remains healthy at `current=0` with ten consecutive zero snapshots through `1778492118910`. Current raw rows are still completed or terminal-recovered workflow friction rather than unresolved dirty exits, with recent samples showing `status=done` and the already-known interrupted cases classified as no-recovery. Chosen operation: `waiting_with_evidence`; continue monitoring until the next metrics snapshot and resume this project only if `session.finish-blocked-unresolved-count-24h` breaches or raw sampling exposes a fresh non-recovered source pattern.

### 2026-05-11 — Alert 287 waiting_with_evidence after latest 58 snapshot

Rechecked P2 raw metric alert 287 after the latest snapshots still held at `58` over threshold `50`. The raw breach is real, but the paired strict unresolved metric remains healthy at `current=0` with the latest ten paired snapshots at strict `0`; the live raw 24h classification found all `58` rows recovered or intentionally terminal (`55` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, `0` other unresolved rows). Chosen operation: `waiting_with_evidence`; keep this project paused/monitoring, validate on the next metrics snapshot, and resume only if the strict unresolved metric breaches or raw sampling exposes a fresh non-recovered dirty-exit pattern.

### 2026-05-11 — Alert 287 waiting_with_evidence recheck at 58 with strict zero

Rechecked P2 raw metric alert 287 after the live metric row and snapshots still reported `current=58` over threshold `50`. The raw breach is real, but the paired strict unresolved metric remains healthy (`session.finish-blocked-unresolved-count-24h current=0`) with the latest ten strict snapshots at `0`. Fresh raw classification again found every row recovered or intentionally terminal: `55` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases; newest samples are done/success scout-explore and scout-heartbeat sessions plus May closed-loop rows that committed runtime handoff files. Chosen operation: `waiting_with_evidence`; continue monitoring rather than calibrating or resolving a still-breaching raw friction metric, with next validation at the next metrics snapshot or immediate project resume if the strict metric breaches or a new non-recovered raw source appears.

### 2026-05-11 — Heartbeat alert 287 hold at 58, no unresolved rows

Heartbeat rechecked the repeated P2 raw metric alert after ten consecutive owner-visible alerts. The raw metric row still reads `current=58`, `threshold=50`, `target=0`, priority `P2`, with alert `287` unresolved; recent snapshots hold at `58` while the paired strict unresolved metric remains healthy at `current=0` with ten consecutive zero snapshots. Fresh classification of the live raw 24h slice again found all rows recovered or intentionally terminal: `55` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases; current attribution is repaired scout/steward/may workflow friction, not a new dirty-exit source needing a patch. Chosen operation: `document_exception` / waiting-with-evidence for this still-breaching raw friction alert, because dev has no safe runtime write path to annotate or downgrade the metric and a root-cause code fix is not indicated while the strict metric is zero. Continue monitoring and resume this project only if `session.finish-blocked-unresolved-count-24h` breaches or raw sampling exposes a fresh non-recovered source pattern; otherwise May/human may choose whether to record a formal low-priority exception/calibration for the raw metric to reduce repeated triage churn.

### 2026-05-11 — Alert 287 waiting_with_evidence at 58 after fresh owner triage

Rechecked P2 raw metric alert 287 after the latest snapshots still held at `58` over threshold `50`. The raw breach remains real, but the paired strict unresolved metric remains healthy (`current=0`) with ten consecutive zero snapshots; fresh classification of the live raw 24h slice found all `58` rows recovered or intentionally terminal (`55` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, `0` other unresolved cases). Chosen operation: `waiting_with_evidence`; this deliberately accepts continued monitoring of raw finish-block friction without a root-cause patch, calibration, downgrade, manual resolve, or escalation, and this project should resume only if the strict metric breaches or raw sampling exposes a fresh non-recovered dirty-exit pattern.

### 2026-05-11 — Alert 287 waiting_with_evidence after raw count eased to 56

Rechecked P2 raw metric alert 287 after the latest snapshot eased to `56` while still breaching threshold `50`. The breach remains real raw finish-block friction, but paired strict unresolved metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` with recent paired snapshots at strict `0`. Fresh raw classification found all `56` rows recovered or intentionally terminal: `53` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases; latest samples are `status=done`/`outcome=done` with success digests. Chosen operation: `waiting_with_evidence`; this project remains paused/monitoring, with next validation on the next metrics snapshot or immediate project resume if the strict metric breaches or raw sampling exposes a fresh non-recovered source pattern.

### 2026-05-11 — Alert 287 heartbeat hold at 58 with all raw rows recovered

Heartbeat rechecked the repeated P2 raw metric alert after the latest metric row still reported `current=58`, `threshold=50`, `target=0`, priority `P2`, and open alert `287`. The paired strict unresolved metric remains healthy at `current=0`; the latest paired snapshots hold raw at `57–58` while strict stays `0`. Fresh classification of the live raw 24h slice found every row recovered or intentionally terminal: `55` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases; source attribution is still repaired scout/steward/may workflow friction rather than a new dirty-exit source needing a patch. Chosen operation: `document_exception` / waiting-with-evidence for this still-breaching raw friction alert, because dev has no safe runtime write path in heartbeat to formally annotate or downgrade the metric and a root-cause code fix is not indicated while the strict metric is zero. Continue monitoring and resume this project only if `session.finish-blocked-unresolved-count-24h` breaches or raw sampling exposes a fresh non-recovered source pattern.

### 2026-05-11 — Alert 287 waiting_with_evidence after repeated 58 raw snapshots

Rechecked P2 raw metric alert 287 after the metric row still reported `current=58`, `threshold=50`, `target=0`, priority `P2`, with alert `287` unresolved. The paired strict unresolved metric remains healthy at `current=0` with the latest ten paired snapshots at strict `0`; fresh raw classification found all `58` rows recovered or intentionally terminal (`55` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, `0` other unresolved cases). Chosen operation: `waiting_with_evidence`; keep this project paused/monitoring instead of calibrating or resolving a still-breaching raw friction metric, with next validation on the next metrics snapshot or immediate project resume if the strict metric breaches or raw sampling exposes a fresh non-recovered dirty-exit pattern.

### 2026-05-11 — Heartbeat hold after guard-alert nudge

Heartbeat rechecked the repeated P2 raw metric alert after May's guard-alert/dirty-worktree nudge. The raw metric still reads `current=58` with an open alert, but the paired strict unresolved metric remains healthy at `current=0` and fresh classification again found no unresolved dirty exits (`55` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows). Pending `handler.workflow_dispatched`, `metric.alert_judged`, `session.end`, `guard.triggered`, and nudge message events were treated as already acted: the latest metric-alert triage recorded a durable `metric.alert_judged` event and May's guard alerts are P3 document-exception/watch items caused by ambient dirty worktree files, not a new source pattern for this project. Chosen operation: `waiting_with_evidence`; no root-cause patch, calibration, or escalation is indicated unless the strict metric breaches or raw sampling exposes a fresh non-recovered dirty-exit pattern.

### 2026-05-11 — Alert 287 waiting_with_evidence hold at raw 58 after latest triage

Rechecked P2 raw metric alert 287 after the metric row and latest snapshots still reported `session.finish-blocked-uncommitted-count-24h=58` over threshold `50`. The paired strict unresolved metric remains healthy at `current=0` with the latest paired snapshots at strict `0`; fresh raw classification found every one of the `58` rows recovered or intentionally terminal (`55` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases). Chosen operation: `waiting_with_evidence`; keep this project paused/monitoring rather than patching, calibrating, downgrading, resolving, or escalating a still-breaching raw friction metric, and resume only if `session.finish-blocked-unresolved-count-24h` breaches or a future raw sample exposes a fresh non-recovered dirty-exit pattern.

### 2026-05-11 — Alert 287 waiting_with_evidence hold after latest 58 snapshots

Rechecked P2 raw metric alert 287 after the latest metric row and snapshots still held `session.finish-blocked-uncommitted-count-24h=58` over threshold `50`. The breach is real raw finish-block friction, but paired strict unresolved metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0`; fresh live classification found all `58` raw rows recovered or intentionally terminal (`55` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases). Chosen operation: `waiting_with_evidence`; this is a deliberate monitoring hold rather than root-cause patch, calibration, downgrade, manual resolve, or escalation, with next validation on the next metrics snapshot and immediate project resume only if the strict metric breaches or raw sampling exposes a new non-recovered dirty-exit pattern.

### 2026-05-11 — Alert 287 waiting_with_evidence hold with current 58 and strict zero

Triaged P2 raw metric alert 287 again after the latest metric row remained `current=58`, `threshold=50`, `target=0`, with the open alert unresolved. The breach is real raw finish-block friction, but the paired strict unresolved metric still reports `current=0` and the latest ten paired snapshots show raw `58` while strict remains `0`. Fresh live classification found all `58` raw rows recovered or intentionally terminal (`55` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases), and recent samples are `status=done`/`outcome=done` success digests or already-terminal no-recovery interruptions. Chosen operation: `waiting_with_evidence`; this deliberately accepts a monitoring hold for the still-breaching raw metric, keeps the project paused, and requires immediate project resume only if `session.finish-blocked-unresolved-count-24h` breaches or future raw sampling exposes a fresh non-recovered dirty-exit pattern.

### 2026-05-11 — Alert 287 documented raw-friction exception at 58+

Documented a project-level exception for repeated P2 alert `session.finish-blocked-uncommitted-count-24h` while the paired strict metric remains healthy. The latest stored metric row still reports raw `current=58` over threshold `50`, and a fresh live source-query/classification pass now finds `59` raw rows but no unresolved dirty exits: `56` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases; source attribution remains repaired scout/steward/may workflow friction. Chosen operation: `document_exception`; accept this raw-friction alert as monitored/expected noise until the next metrics snapshot or until `session.finish-blocked-unresolved-count-24h` breaches / raw sampling exposes a fresh non-recovered source pattern, at which point resume this project immediately.

### 2026-05-11 — Alert 287 documented exception reaffirmed at raw 59

Rechecked repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the stored metric row reached `current=59` over threshold `50`. The breach remains real raw finish-block friction, but paired strict metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` with the latest ten strict snapshots at `0`; fresh classification of the live raw 24h slice found no unresolved dirty exits (`56` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases). Chosen operation: `document_exception`; keep accepting the still-breaching raw alert as monitored/expected friction in this paused project unless the strict metric breaches or future raw sampling exposes a new non-recovered source pattern, at which point resume the project immediately.

### 2026-05-11 — Alert 287 document_exception maintained at raw 59

Rechecked repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the latest snapshots held at `current=59` over threshold `50`. The breach is real raw finish-block friction, not stale: the open alert `287` remains unresolved and the metric source query still counts finish-blocked evaluator rows. The paired strict unresolved metric remains healthy at `current=0` with the latest paired snapshots at strict `0`, and fresh classification of the live raw 24h slice found all `59` rows recovered or intentionally terminal (`56` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases). Chosen operation: `document_exception`; continue accepting this still-breaching raw alert as monitored/expected friction for the paused project, with immediate resume only if `session.finish-blocked-unresolved-count-24h` breaches or raw sampling exposes a fresh non-recovered dirty-exit source pattern.

### 2026-05-11 — Alert 287 document_exception maintained at raw 59 with strict zero

Triaged repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after ten recent snapshots stayed at `current=59` over threshold `50`. The breach is real raw finish-block friction and alert `287` remains unresolved, but paired strict metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` with paired snapshots at strict `0`; fresh live classification found all `59` raw rows recovered or intentionally terminal (`56` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases), with source attribution concentrated in repaired scout/steward/may workflow friction. Chosen operation: `document_exception`; continue accepting this raw alert as a monitored project-level exception while strict unresolved stays zero, and resume immediately only if `session.finish-blocked-unresolved-count-24h` breaches or raw sampling exposes a fresh non-recovered dirty-exit pattern.

### 2026-05-11 — Alert 287 document_exception maintained at raw 60 with strict zero

Triaged repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the latest metric row reached `current=60` over threshold `50` and alert `287` remained unresolved. The breach is real raw finish-block friction, but paired strict metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` with the latest ten paired snapshots at strict `0`; fresh live classification found all `60` raw rows recovered or intentionally terminal (`57` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases), with source attribution still concentrated in repaired scout/steward/may workflow friction. Chosen operation: `document_exception`; continue accepting this raw alert as a monitored project-level exception while strict unresolved stays zero, and resume immediately only if `session.finish-blocked-unresolved-count-24h` breaches or raw sampling exposes a fresh non-recovered dirty-exit pattern.

### 2026-05-11 — Alert 287 document_exception maintained at raw 61 with strict zero

Triaged repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the latest metric row reached `current=61` over threshold `50` and alert `287` remained unresolved. The breach is real raw finish-block friction, but the paired strict metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` with the latest paired snapshots at strict `0`; fresh live classification found all `61` raw rows recovered or intentionally terminal (`58` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases), with source attribution still concentrated in repaired scout/steward/may workflow friction. Chosen operation: `document_exception`; continue accepting this still-breaching raw alert as a monitored project-level exception while strict unresolved stays zero, and resume immediately only if `session.finish-blocked-unresolved-count-24h` breaches or raw sampling exposes a fresh non-recovered dirty-exit pattern.

### 2026-05-11 — Alert 287 document_exception reaffirmed at raw 61 after owner recheck

Rechecked repeated P2 alert `session.finish-blocked-uncommitted-count-24h` with the stored metric row still at `current=61`, threshold `50`, and alert `287` unresolved. The paired strict unresolved metric remains healthy at `current=0` with the latest ten paired snapshots at strict `0`; fresh live raw classification found all `61` rows recovered or intentionally terminal (`58` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases), with current top sources still repaired scout/steward/may workflow friction (`scout-heartbeat=19`, `scout-explore=16`, `closed-loop-steward=10`). Chosen operation: `document_exception`; maintain the documented raw-friction exception and keep the project paused/monitoring, with immediate resume only if `session.finish-blocked-unresolved-count-24h` breaches or raw sampling exposes a fresh non-recovered dirty-exit pattern.

### 2026-05-11 — Alert 287 document_exception maintained at raw 62 with strict zero

Heartbeat rechecked repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the stored metric row reached `current=62` over threshold `50`. The breach remains real raw finish-block friction, but paired strict metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` with the latest ten strict snapshots at `0`; fresh live classification found all `62` raw rows recovered or intentionally terminal (`59` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases), with source attribution still concentrated in repaired scout/steward/may workflow friction. Chosen operation: `document_exception`; continue accepting this raw alert as a monitored project-level exception while strict unresolved stays zero, and resume immediately only if `session.finish-blocked-unresolved-count-24h` breaches or raw sampling exposes a fresh non-recovered dirty-exit pattern.

### 2026-05-11 — Alert 287 document_exception maintained at raw 62 with live classification

Triaged repeated P2 alert `session.finish-blocked-uncommitted-count-24h` again after the stored metric row remained `current=62` over threshold `50` and alert `287` remained unresolved. The breach is real raw finish-block friction, but paired strict metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` with the latest ten strict snapshots at `0`; fresh live classification found all `62` raw rows recovered or intentionally terminal (`59` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases), with source attribution still concentrated in repaired scout/steward/may workflow friction (`scout-heartbeat=19`, `scout-explore=17`, `workflow:closed-loop-steward=10`). Chosen operation: `document_exception`; continue accepting this still-breaching raw alert as a monitored project-level exception while strict unresolved stays zero, and resume immediately only if `session.finish-blocked-unresolved-count-24h` breaches or raw sampling exposes a fresh non-recovered dirty-exit pattern.

### 2026-05-11 — Alert 287 document_exception maintained at raw 63 with strict zero

Triaged repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the stored metric row reached `current=63` over threshold `50` and alert `287` remained unresolved. The breach remains real raw finish-block friction, but paired strict metric `session.finish-blocked-unresolved-count-24h` is still healthy at `current=0` with the latest ten paired snapshots at strict `0`; fresh live classification found all `63` raw rows recovered or intentionally terminal (`60` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases), with source attribution still concentrated in repaired scout/steward/may workflow friction (`workflow:scout-heartbeat=19`, `workflow:scout-explore=17`, `workflow:closed-loop-steward=10`). Chosen operation: `document_exception`; continue accepting this still-breaching raw alert as a monitored project-level exception while strict unresolved stays zero, and resume immediately only if `session.finish-blocked-unresolved-count-24h` breaches or raw sampling exposes a fresh non-recovered dirty-exit pattern.

### 2026-05-11 — Alert 287 document_exception reaffirmed at raw 63 with no unresolved rows

Triaged repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the stored metric row and latest snapshots remained at `current=63` over threshold `50`. The alert is real raw finish-block friction, not stale, but the paired strict metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` with ten consecutive strict-zero snapshots; fresh live classification found all `63` raw rows recovered or intentionally terminal (`60` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases). Source attribution remains repaired workflow friction (`workflow:scout-heartbeat=20`, `workflow:scout-explore=17`, `workflow:closed-loop-steward=10`) rather than a fresh unrecovered dirty-exit pattern. Chosen operation: `document_exception`; maintain the project-level exception for this still-breaching raw alert while strict unresolved stays zero, and resume immediately only if `session.finish-blocked-unresolved-count-24h` breaches or raw sampling exposes a new non-recovered source pattern.

### 2026-05-11 — Alert 287 document_exception maintained at raw 63 after latest owner triage

Rechecked repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the metric row and latest ten snapshots still held at `current=63` over threshold `50`, with alert `287` unresolved. The breach remains real raw finish-block friction, but the paired strict unresolved metric remains healthy at `current=0` with the latest ten paired snapshots at strict `0`; fresh live classification found all `63` raw rows recovered or intentionally terminal (`60` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases). Source attribution remains repaired scout/steward workflow friction (`workflow:scout-heartbeat=20`, `workflow:scout-explore=17`, `workflow:closed-loop-steward=10`) rather than a new unrecovered dirty-exit pattern. Chosen operation: `document_exception`; maintain the documented project-level exception while strict unresolved stays zero, and resume immediately only if `session.finish-blocked-unresolved-count-24h` breaches or future raw sampling exposes a fresh non-recovered source pattern.

### 2026-05-11 — Alert 287 document_exception maintained at raw 64 with strict zero

Heartbeat triaged the repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the stored metric row reached `current=64` over threshold `50`, with alert `287` still unresolved. The breach is real raw finish-block friction, but the paired strict unresolved metric remains healthy at `current=0` with the latest paired snapshots at strict `0`; the live raw source query also returns `64`. Fresh classification using the registered strict metric's `session_digests` shape found all `64` raw rows recovered or intentionally terminal (`61` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases), with top attribution still repaired scout/steward/may workflow friction (`workflow:scout-heartbeat=21`, `workflow:scout-explore=17`, `workflow:closed-loop-steward=10`). Chosen operation: `document_exception`; maintain the project-level exception while strict unresolved stays zero, and resume immediately only if `session.finish-blocked-unresolved-count-24h` breaches or future raw sampling exposes a fresh non-recovered dirty-exit pattern.

### 2026-05-11 — Alert 287 document_exception reaffirmed at raw 64 with all rows recovered

Metric-alert triage rechecked repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the stored metric row and latest snapshots remained at `current=64` over threshold `50`, with alert `287` still unresolved. The breach remains real raw finish-block friction, but paired strict metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` with the latest ten paired snapshots at strict `0`; fresh live classification found all `64` raw rows recovered or intentionally terminal (`61` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved cases). Source attribution remains repaired scout/steward/may workflow friction (`workflow:scout-heartbeat=21`, `workflow:scout-explore=17`, `workflow:closed-loop-steward=10`) rather than a new unrecovered dirty-exit pattern. Chosen operation: `document_exception`; maintain the documented project-level exception while strict unresolved stays zero, and resume immediately only if `session.finish-blocked-unresolved-count-24h` breaches or future raw sampling exposes a fresh non-recovered dirty-exit pattern.

### 2026-05-11 — Alert 287 document_exception maintained at raw 61 with strict zero

Metric-alert triage rechecked repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the stored metric row eased to `current=61` but remained above threshold `50`, with alert `287` still unresolved. The breach remains real raw finish-block friction, but the paired strict unresolved metric remains healthy at `current=0` with the latest ten paired snapshots at strict `0`; fresh live classification found all current raw rows recovered or intentionally terminal (`58` repaired successful exits, `1` repaired partial exit, `1` terminal no-recovery interrupted row, and `0` other unresolved cases). Source attribution remains repaired workflow friction (`workflow:scout-heartbeat=20`, `workflow:scout-explore=18`, `workflow:closed-loop-steward=10`) rather than a new unrecovered dirty-exit pattern, and the newest raw samples are `status=done`/`outcome=done` with success digests. Chosen operation: `document_exception`; maintain the project-level exception for this still-breaching raw alert while strict unresolved stays zero, and resume immediately only if `session.finish-blocked-unresolved-count-24h` breaches or future raw sampling exposes a fresh non-recovered source pattern.

### 2026-05-11 — Alert 287 document_exception maintained at raw 60 after downward drift

Metric-alert triage rechecked repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the stored metric row eased to `current=60` but remained above threshold `50`, with alert `287` still unresolved. The breach remains real raw finish-block friction, not stale, but paired strict metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` with the latest ten paired snapshots at strict `0`; fresh live classification found all current raw rows recovered or intentionally terminal (`58` repaired successful exits, `1` repaired partial exit, `1` terminal no-recovery interrupted row, and `0` other unresolved cases). Source attribution remains repaired workflow friction (`workflow:scout-heartbeat=21`, `workflow:scout-explore=18`, `workflow:closed-loop-steward=10`) rather than a new unrecovered dirty-exit pattern. Chosen operation: `document_exception`; maintain the project-level exception for this still-breaching raw alert while strict unresolved stays zero, and resume immediately only if `session.finish-blocked-unresolved-count-24h` breaches or future raw sampling exposes a fresh non-recovered source pattern.

### 2026-05-11 — Alert 287 document_exception reaffirmed at raw 59 with strict zero

Metric-alert triage rechecked repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the stored metric row eased to `current=59` but remained above threshold `50`, with alert `287` still unresolved. The breach remains real raw finish-block friction, not stale, but paired strict metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` with the latest ten strict snapshots at `0`; fresh live classification found all current raw rows recovered or intentionally terminal (`57` repaired successful exits, `1` repaired partial exit, `1` terminal no-recovery interrupted row, and `0` other unresolved cases). Source attribution remains repaired workflow friction (`workflow:scout-heartbeat=21`, `workflow:scout-explore=17`, `workflow:closed-loop-steward=10`) rather than a new unrecovered dirty-exit pattern. Chosen operation: `document_exception`; maintain the project-level exception for this still-breaching raw alert while strict unresolved stays zero, with next validation on the next metrics snapshot and immediate project resume only if `session.finish-blocked-unresolved-count-24h` breaches or future raw sampling exposes a fresh non-recovered source pattern.

### 2026-05-11 — Alert 287 document_exception maintained after raw eased to 57

Metric-alert triage rechecked repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the stored metric row eased to `current=57` but remained above threshold `50`, with alert `287` still unresolved. The breach remains real raw finish-block friction, but paired strict metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` with the latest ten paired snapshots at strict `0`; fresh live classification found all current raw rows recovered or intentionally terminal (`55` repaired successful exits, `1` repaired partial exit, `1` terminal no-recovery interrupted row, and `0` other unresolved cases). Source attribution remains repaired workflow friction (`workflow:scout-heartbeat=19`, `workflow:scout-explore=16`, `workflow:closed-loop-steward=10`) rather than a new unrecovered dirty-exit pattern. Chosen operation: `document_exception`; maintain the documented project-level exception for this still-breaching raw alert while strict unresolved stays zero, with next validation on the next metrics snapshot and immediate project resume only if `session.finish-blocked-unresolved-count-24h` breaches or future raw sampling exposes a fresh non-recovered source pattern.

### 2026-05-11 — Heartbeat document_exception maintained at stored raw 56

Heartbeat rechecked repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the stored metric row eased to `current=56` while still breaching threshold `50`, with alert `287` still unresolved. The breach remains real raw finish-block friction, but paired strict metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` with the latest ten strict snapshots at `0`; fresh live classification found no unresolved dirty exits in the raw 24h slice (`55` repaired successful exits, `1` repaired partial exit, `1` terminal no-recovery interrupted row, and `0` other unresolved cases), with source attribution still concentrated in repaired scout/steward workflow friction. Chosen operation: `document_exception`; maintain the monitored project-level exception while strict unresolved stays zero, and resume immediately only if the strict metric breaches or future raw sampling exposes a fresh non-recovered dirty-exit pattern.

### 2026-05-11 — Alert 287 document_exception maintained at current raw 57

Metric-alert triage rechecked repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the stored metric row remained `current=57` over threshold `50`, with alert `287` still unresolved. The breach remains real raw finish-block friction, but paired strict metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` with the latest ten paired snapshots at strict `0`; fresh live classification found all current raw rows recovered or intentionally terminal (`55` repaired successful exits, `1` repaired partial exit, `1` terminal no-recovery interrupted row, and `0` other unresolved cases), with source attribution concentrated in repaired scout/steward workflow friction. Chosen operation: `document_exception`; maintain the documented project-level exception while strict unresolved stays zero, with next validation on the next metrics snapshot and immediate project resume only if `session.finish-blocked-unresolved-count-24h` breaches or future raw sampling exposes a fresh non-recovered source pattern.

### 2026-05-11 — Alert 287 document_exception maintained after raw eased to 54

Metric-alert triage rechecked repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the stored metric row eased to `current=54` while still breaching threshold `50`, with alert `287` still unresolved. The breach remains real raw finish-block friction, but paired strict metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` with the latest ten paired snapshots at strict `0`; fresh live classification found all current raw rows recovered or intentionally terminal (`52` repaired successful exits, `1` repaired partial exit, `1` terminal no-recovery interrupted row, and `0` other unresolved cases), and the latest samples are completed scout/may sessions with success digests or already-terminal no-recovery handling. Chosen operation: `document_exception`; maintain the documented project-level exception for this still-breaching raw alert while strict unresolved stays zero, with next validation on the next metrics snapshot and immediate project resume only if `session.finish-blocked-unresolved-count-24h` breaches or future raw sampling exposes a fresh non-recovered source pattern.

### 2026-05-11 — Alert 287 document_exception maintained at current raw 54

Metric-alert triage rechecked repeated P2 alert `session.finish-blocked-uncommitted-count-24h` after the stored metric row reported `current=54` over threshold `50`, with alert `287` still unresolved. The breach remains real raw finish-block friction, but paired strict metric `session.finish-blocked-unresolved-count-24h` remains healthy at `current=0` with the latest ten paired snapshots at strict `0`; fresh live classification found all current raw rows recovered or intentionally terminal (`53` repaired successful exits, `1` terminal no-recovery interrupted row, and `0` other unresolved cases), with top attribution in repaired scout/steward/may workflow friction. Chosen operation: `document_exception`; maintain the documented project-level exception while strict unresolved stays zero, with next validation on the next metrics snapshot and immediate project resume only if `session.finish-blocked-unresolved-count-24h` breaches or future raw sampling exposes a fresh non-recovered source pattern.

## Artifacts
- outputs/iteration-5-source-specific-residual-sampling.md
- outputs/iteration-6-split-metric-registration.md
- outputs/iteration-1-source-attribution-and-prompt-patches.md
- outputs/iteration-2-post-patch-evaluator-routing.md
- outputs/iteration-1-orchestrator-goal-driver-addendum.md
- outputs/iteration-1-evaluator-self-repair-classification.md
- outputs/iteration-3-fresh-incidence-and-tracking.md
- outputs/iteration-1-live-residual-attribution.md

## Context
- Iteration 1 completed source attribution and prompt-path patches for heartbeat, closed-loop-steward, metric-alert-triage, project, orchestrator, and goal-driver paths.
- Current live 24h finish/uncommitted count remains about 234, but the dominant residual bucket is repaired/completed sessions, not unresolved dirty exits.
- Fresh review query found 226 finish/uncommitted evaluations with `digest_outcome=success`, `session.status=done`, `session.outcome=done`, yet still `verdict=needs_improvement`.
- Next highest-leverage work is post-patch evaluator-routing validation: split pre/post evaluator self-repair patch and sample post-patch repaired-success sessions still classified `needs_improvement`.
- Iteration 2 committed evaluator classifier patch `c052855aa` at `2026-05-09T15:11:15Z`; it recognizes `finish blocked -> commit -> finish(success)` as repaired clean exit.
- Iteration 2 added a regression test in `agents/shared/tests/evaluator-aftermath.test.ts`; worker reported 27 evaluator aftermath tests passing.
- Fresh post-`c052855aa` DB check found 1 finish/uncommitted evaluation and it routed `good`, with `session.status=done`, `session.outcome=done`, and latest digest `success`.
- Next validation should focus on fresh post-`c052855aa` raw incidence and durable split metrics for raw finish-blocked attempts versus unresolved dirty exits.
- Iteration 5 found 25 post-`c052855aa` finish-blocked rows: 19 `good`, 6 `needs_improvement`, and 0 strict unresolved dirty exits; residual NI rows were review overrides or one anti-shallow penalty.
- Independent review query at 2026-05-09T20:31Z found raw_24h=208, strict_unresolved_24h=3, post_cutoff_raw=26, post_cutoff_strict_unresolved=0.
- The live `metrics` table still has no rows for `session.finish-blocked-uncommitted-count-24h` or `session.finish-blocked-unresolved-count-24h`; next work should register or prepare an approval packet for these split metrics.
- Iteration 6 completed **Add or propose tracking** by producing `outputs/iteration-6-split-metric-registration.md`, an approval/ops packet with idempotent SQL for the raw and strict finish-blocked metrics.
- Review recheck found both split metrics still absent from `metrics`; current read-only source-query values are raw_24h=209 and strict_unresolved_24h=3.
- Project is blocked on safe runtime DB write authority to register the two metric rows and verify `metric_snapshots`; no further worker sampling/prompt patching is indicated unless strict unresolved exits increase.
