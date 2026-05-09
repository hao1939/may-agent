---
id: finish-blocked-hygiene-reduction
owner: dev
status: active
type: milestone
priority: P1
workflow: project
iteration: 4
stop_reason: null
resume_condition: Fresh post-c052855aa finish/uncommitted evaluations are again routing needs_improvement; resume condition met on 2026-05-09 heartbeat.
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

Iteration 4 reopened the project from `pending-review`: the resume trigger fired because fresh post-`c052855aa` finish/uncommitted evaluations are routing `needs_improvement` again. Heartbeat validation found 23 post-patch finish/uncommitted rows: 18 `good` and 5 `needs_improvement`, with residual needs-improvement cases in `workflow:scout-explore`, `workflow:dev-heartbeat`, `workflow:scout-heartbeat`, and `closed-loop-steward`. Next action is source-specific sampling to distinguish true unresolved dirty exits from repaired exits still overridden by review metadata.

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

## Artifacts
- outputs/iteration-1-source-attribution-and-prompt-patches.md
- outputs/iteration-2-post-patch-evaluator-routing.md
- outputs/iteration-1-orchestrator-goal-driver-addendum.md
- outputs/iteration-1-evaluator-self-repair-classification.md
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
