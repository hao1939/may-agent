# Evaluation App

Evaluation independently reviews exact Task evidence owned by other Agent Apps: both historical outcomes and bounded current obligations at meaningful review boundaries. It publishes evidence-backed reports; the responsible App retains remediation authority. Evaluation does not become a second planner, fixer, issue queue, or controller for the target.

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

A Task—not one worker session—is the accountability unit. Historical review reconstructs assignment, delegation, corrections, recovery, verification, and delivery. Ongoing review uses a separately versioned rubric and due-phase identity to inspect active work, waits, recovery, dependencies, approvals, and overdue boundaries without treating status or age alone as failure. Evaluation-owned work is excluded. Missing identity or evidence yields neutral `insufficient-evidence`, never a target failure or healthy coverage.

Automatic semantic sampling is **off by default**. No selector schedule exists unless `EVALUATION_AUTO_REVIEW_ENABLED=true`. The previously observed rollout used serialized daily sampling; see [the rollout record](design/rollout-and-migration-2026-09.md). This candidate prepares a switch to the existing latest-slot input schedule for restart catch-up and slot deduplication, but that source change is not observed or live until separately approved and activated. There is no active two-hour schedule. App discovery is capped at 20, semantic calls use a small shared slot allowance, and each wake emits at most one exact review request.

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

When explicitly enabled, the selector discovers at most 20 external Apps with bounded `apps.list`, then reads Task projections with public `tasks.list(appId, includeDone: true)`. Recent completed outcomes use an initially configurable seven-day window; open obligations remain eligible beyond it. Each page asks for one keyset-ordered Task and the selector persists the returned opaque continuation after considering it, with at most two page reads per visited App by default. This bounded traversal advances despite a dropped review request and remains fair when a selected Task moves back to the front. It rotates Apps after every selection, excludes Evaluation, and emits at most one ordinary review request per wake. Versioned state retains only the next App and bounded public continuations; full Task identities remain only in emitted requests. Cursor expiry or ordering-contract changes can restart a scan, so this is honest bounded sampling rather than exhaustive coverage. Malformed or truncated reads remain explicit coverage facts. Exact `app.task.get` and `task.get` identity/provenance checks still occur before semantic review. Under the same opt-in flag, production `project.task.reconciled` facts with `incomplete` or `retrying` disposition request an exact ongoing review, so known failed attempts need not wait for the periodic sample; current Task evidence is reread and the shared allowance still applies. Other stalled obligations rely on the unchanged fair periodic sample, whose bounded cadence can delay detection. Exhausted semantic allowance keeps the exact review waiting with its evidence identity and absolute `reviewAt`. The Host reconsiders that Task at the deadline; elapsed time does not satisfy an external fact. Reports state the loaded definition source as unavailable when runtime context does not expose an exact identity; environment labels are not treated as activation provenance. `maxConcurrent: 1` keeps initial rollout serialized.

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
- `design/deepseek-v4-flash-evaluator-pilot-2026-09.md` — frozen pilot evidence and the rejected model-specific prompt experiment.

## Commands

```sh
bun run check
bun run bundle
```

No source check deploys, mutates runtime state, or enables automatic sampling.
