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

A Task—not one worker session—is the accountability unit. Historical review reconstructs assignment, delegation, corrections, recovery, verification, and delivery. Ongoing review uses a separately versioned rubric and due-phase identity to inspect active work, waits, recovery, dependencies, approvals, and overdue boundaries without treating status or age alone as failure. Its validity identity combines unresolved Condition deadlines with the Host's authoritative current Task `reviewAt` and per-input-wait `reviewAt`; independent later boundaries remain visible, while supported obligations without a deadline keep phase `unknown`. Evaluation-owned work is excluded. Missing identity or evidence yields neutral `insufficient-evidence`, never a target failure or healthy coverage.

Automatic semantic sampling is **off by default**. No selector schedule exists unless `EVALUATION_AUTO_REVIEW_ENABLED=true`. For backward compatibility, the selector defaults to the existing `evaluator` reviewer and its existing daily source default. The current installation explicitly selects `evaluator-deepseek` every five minutes with a separate one-attempt-per-five-minutes allowance, while Sol retains its hourly allowance for explicit and already-retained Sol reviews. DeepSeek reports are screening leads for May to verify against current exact evidence, not authoritative current-health verdicts; a no-finding report does not certify health. See [the rollout record](design/rollout-and-migration-2026-09.md) and [DeepSeek pilot](design/deepseek-v4-flash-evaluator-pilot-2026-09.md). A source change is not observed or live until separately reviewed and activated. App discovery is capped at 20 and each wake emits at most one exact review request.

Legacy session-aftermath, deep-evaluation, project-health, and executable Tasks remain historical evidence. The Host requires every Task intent to name a structural parent, so all supported inputs use the surviving non-executable `evaluation-system` root group; they do not depend on any cancelled legacy subgroup. Compatibility entrypoints use a distinct `runtime/compat/*` namespace and do not perform new session-only semantic scoring, so they cannot revive or reuse retired Task identities. The App manifest declares all 11 legacy Evaluation metrics as `retired` so normal activation retires persisted definitions without deleting measurements; metric breach/recovery events do not wake an Evaluation owner lane.

Evaluation's local owner still retains ordinary operational failures and retries.
The staged May source independently samples retained Evaluation terminal attempts
with its existing metrics and also discovers unresolved pre-attempt
`input-admission` recovery from durable inbox state. One Task generation with
three unsuccessful attempts in six hours, or one admission boundary with three
retries, opens the existing alert episode. Coverage includes
`runtime/compat/owner-review`, failed/rejected attempts, accepted-incomplete
results, stale/requeued interruptions, and inputs that have not yet produced an
attempt; user cancellation is excluded. Because collection reads retained state,
a 58-retry admission boundary remains discoverable after installation or restart
without replaying a failure event. The sample discloses its denominator, cut and
limits. May uses the existing alert identity and metric follow-through, rather
than receiving every `project.task.reconciled`, `handler.failed`, or first
admission-failure fact as a Conversation/model call. Repeat samples in an open
episode remain quiet. This is operational oversight, not Evaluation semantic
self-review: original retries and caller links continue, and admission recovery,
notification or aggregate recovery cannot fulfill the original Evaluation input.
It adds neither an event registry, generic supervisor fallback nor May control
of Evaluation Tasks.

That oversight is a source candidate, not an installed claim. It becomes current
behavior only after separate review, activation and installed-definition
read-back; Evaluation's loaded README/source revision does not prove May's live
subscription or metric set.

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

The [systemic pattern review proposal](design/systemic-pattern-review-20260927.md)
describes the next coverage improvement: aggregate retained attempt evidence can
surface recurring problems even after individual Tasks recover. Its offline
trials do not change the currently installed selector or reviewer.

When explicitly enabled, the selector discovers at most 20 external Apps with bounded `apps.list`, canonically normalizes `.app` catalog names, excludes Evaluation, and samples every other discovered App rather than a pilot allowlist. It then reads Task projections with public `tasks.list(appId, includeDone: true)`. Recent completed outcomes use an initially configurable seven-day window; open obligations remain eligible beyond it. Each page asks for one keyset-ordered Task and the selector persists the returned opaque continuation after considering it, with at most two page reads per visited App by default. This bounded traversal advances despite a dropped review request and remains fair when a selected Task moves back to the front. It rotates Apps after every selection, excludes Evaluation, and emits at most one ordinary review request per wake. Versioned state retains only the next App and bounded public continuations; full Task identities remain only in emitted requests. Cursor expiry or ordering-contract changes can restart a scan, so this is honest bounded sampling rather than exhaustive coverage. Malformed or truncated reads remain explicit coverage facts. Exact `app.task.get` and `task.get` identity/provenance checks still occur before semantic review. Under the same opt-in flag, production `project.task.reconciled` facts with `incomplete` or `retrying` disposition request an exact ongoing review, so known failed attempts need not wait for the periodic sample; current Task evidence is reread and the shared allowance still applies. Other stalled obligations rely on the unchanged fair periodic sample, whose bounded cadence can delay detection. Exhausted semantic allowance keeps the exact review waiting with its evidence identity and absolute `reviewAt`. The Host reconsiders that Task at the deadline; elapsed time does not satisfy an external fact. Reports state the loaded definition source as unavailable when runtime context does not expose an exact identity; environment labels are not treated as activation provenance. `maxConcurrent: 1` keeps initial rollout serialized.

## DeepSeek screening profile

The Host model entry is live at merge `1c04195bd5ae48f30817bd21b762b01f976ee7c5`, and App reload event `6391108` loaded `evaluator-deepseek` from source `0b0f1e6a4a02757daea87a6607fe306087b0e773`. The retained rollout record is `/app/.state/review-pilots/deepseek-evaluator-20260921/ROLLOUT.md`. The supervisor now uses the existing configuration boundary to select this profile for routine screening; there is still one selector and one serialized Evaluation lifecycle.

DeepSeek screening has a separate one-attempt-per-five-minutes ceiling. Sol retains its hourly allowance for explicit and already-retained Sol reviews. Inspect `candidate-shadow-F20PnM/receipt.json` and `candidate-shadow-EuhuqG/receipt.json` under the retained pilot root before interpreting results: the first proves connection/publication behavior and a useful neutral missing-evidence result, while the second is not an exact-snapshot quality pass because the tool-enabled agent read live files outside the supplied snapshot.

Treat every DeepSeek report as a lead. May must use the existing publication-intake path, reread the current subject, and classify material claims as confirmed, rejected, or uncertain before repair or escalation. Keep routine/no-op reports quiet; do not count no-finding as certified health. Record useful impact and total verification cost/latency for the first operational sample. Keep `maxConcurrent: 1`; do not reset allowance receipts or rewrite existing review Tasks. Roll back through the supervisor-managed environment refresh. Existing Sol reports and Tasks remain readable and retain their saved waits; no model output may approve or apply an improvement.

## Public actions

When evaluating another local installation, configure both `MAY_CONTROL_SOCKET`
and `MAY_REPORT_BASE_URL` to address that same Host. Task and event reads use
the socket; session, transcript and attempt reports use the HTTP base URL
(default `http://localhost:8080`). Set `EVALUATION_REPORT_ROOT` for that
installation's generated reports too. An unavailable endpoint remains a coverage
gap; Evaluation does not fall back to another installation. Source configuration
changes require ordinary App activation.

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

Population review uses the same scheduled selector and Task review path. Its
`task-obligation-v2` reports show two fixed 24-hour attempt populations, separate
from the exact Task's current state. Inspect `selector:population-*` facts for
selection/deferral, then follow the selected review Task to its immutable report.
A selection marked `report-pending` is not completed coverage. See the
[implementation and limits](design/systemic-pattern-review-20260927.md#first-implementation-and-its-deliberate-limits).
