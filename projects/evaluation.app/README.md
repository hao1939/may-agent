# Evaluation App

Evaluation independently reviews historical outcomes owned by other Agent Apps. It publishes evidence-backed reports; the responsible App retains remediation authority. Evaluation does not become a second planner, fixer, issue queue, or controller for the target.

## Current behavior

The canonical semantic path reviews one exact external `(appId, taskId)` through public App and Task reads:

```text
explicit review request
  -> bounded canonical Task evidence
  -> one evaluator judgment
  -> immutable JSON + deterministic Markdown
  -> accepted publication event and marker
  -> deterministic list/read actions
```

A Task outcome—not one worker session—is the accountability unit. The review reconstructs the historical assignment, delegation, corrections, recovery, verification, and delivery. Evaluation-owned work is excluded. Missing identity or evidence yields neutral `insufficient-evidence`, never a target failure or healthy coverage.

Automatic semantic sampling is **off by default**. No selector schedule exists unless `EVALUATION_AUTO_REVIEW_ENABLED=true`. After manual calibration and bounded canaries, the observed rollout enables serialized daily sampling; see [the rollout record](design/rollout-and-migration-2026-09.md). There is no active two-hour schedule. App discovery is capped at 20 so every visited App retains bounded navigation history.

Legacy session-aftermath, deep-evaluation, project-health, and executable Tasks remain historical evidence. The Host requires every Task intent to name a structural parent, so all supported inputs use the surviving non-executable `evaluation-system` root group; they do not depend on any cancelled legacy subgroup. Compatibility entrypoints use a distinct `runtime/compat/*` namespace and do not perform new session-only semantic scoring, so they cannot revive or reuse retired Task identities. The App manifest declares all 11 legacy Evaluation metrics as `retired` so normal activation retires persisted definitions without deleting measurements; metric breach/recovery events do not wake an Evaluation owner lane.

## Reports

Successful review stages an immutable pair beneath the configured durable root:

```text
${EVALUATION_REPORT_ROOT}
# or ${MAY_PERSIST_DIR:-/app/.state}/evaluation/reports

task-outcomes/<app>/task-outcome-v2/<task>-<evidence-hash>.json
task-outcomes/<app>/task-outcome-v2/<task>-<evidence-hash>.md
task-outcomes/<app>/task-outcome-v2/<task>-<evidence-hash>.published.json
```

The publication marker is written only after `evaluation.task_report_published` is accepted. Listing and reading require that marker and revalidate the JSON identity, both recorded SHA-256 hashes, and deterministic Markdown content. A failed publication therefore leaves staged files undiscoverable; retry can publish the same validated bytes without another model call.

Reports are evidence, not commands or issue state. A reader should distinguish report creation time from the dates of the work it covers, and distinguish publication, owner acknowledgment, a fix claim, and independent recheck. Reading or listing never starts another evaluation.

The installed App contract exposes the `read-reports` input directly. These inputs use the ordinary Task mechanism and make no evaluator/model call:

```json
{"kind":"read-reports","data":{"operation":"list","limit":5}}
{"kind":"read-reports","data":{"operation":"read","path":"task-outcomes/scout/task-outcome-v2/<listed-report>.md"}}
```

The equivalent named actions are `list-evaluation-reports` and `read-evaluation-report`. List first, then pass a listed relative path to read. A read returns a bounded preview plus byte count, SHA-256, canonical absolute artifact path, and continuation offset/path when full content is larger than the result budget. The canonical durable root is `${EVALUATION_REPORT_ROOT:-${MAY_PERSIST_DIR:-/app/.state}/evaluation/reports}`; deployment may override it with `EVALUATION_REPORT_ROOT`. Treat filesystem paths as paths, not invented web URLs; provide clickable references only where the caller's interface supports them.

## Selection and cost

When explicitly enabled, the selector discovers at most 20 external Apps with bounded `apps.list`, then reads recently updated Task projections with public `tasks.list(appId, includeDone: true)`. It considers an initially configurable seven-day window, reads at most two small pages per visited App by default, rotates Apps after every selection, excludes Evaluation, and emits at most one ordinary review request per wake. Bounded versioned navigation facts in the selector Task remember the next App and a short SHA-256 digest of the last attempted Task identity per App; exhausted scans preserve those markers, circularly reconsider newly inserted recent Tasks, and skip malformed pages/items while retaining bounded diagnostics. Full Task identities remain in the emitted request, and legacy `app.tasks.list` cursor facts reset neutrally. Exact `app.task.get` and `task.get` identity/provenance checks still occur before semantic review. Old outcomes remain explicitly reviewable. `maxConcurrent: 1` keeps initial rollout serialized.

## Public actions

- `review-task-outcome` — review one exact external App Task.
- `list-evaluation-reports` — list accepted, integrity-checked reports.
- `read-evaluation-report` — read a bounded preview of one listed report.
- Historical/manual compatibility actions remain available where declared in `app.ts`, but do not create automatic session-scoring authority.

## Layout

- `app.ts` — App inputs, actions, Task mapping, and initially-off selector schedule.
- `agents/evaluator/workflows/task-outcome-review.ts` — evidence-bound review and publication.
- `agents/evaluator/workflows/task-outcome-selector.ts` — bounded fair selection.
- `agents/evaluator/workflows/evaluation-report-reader.ts` — deterministic report discovery/read-back.
- `criteria/criteria.md` — current Task-outcome responsibility criteria.
- `criteria/scoring.md` and `criteria/versions/` — historical session-scoring compatibility material.
- `design/task-outcome-evaluation.md` — implemented architecture and rollout boundary.
- `design/rollout-and-migration-2026-09.md` — operator-owned staged activation and rollback.

## Commands

```sh
bun run check
bun run bundle
```

No source check deploys, mutates runtime state, or enables automatic sampling.
