# Task-outcome evaluation and report use

**Status:** The explicit single-Task review, durable report store, deterministic list/read path, legacy Task retirement, recent-window/fair-rotation selector, and report-discovery polish are deployed from App revision `79dd65e91f`. Four published reports—three assessed and one inconclusive—have an evaluator-session usage estimate of $0.479074; this is not a billing receipt, excludes May/reviewer costs, and is not report-recorded cost. A natural May query read the retained reports without a new evaluator run. Two bounded selector canaries rotated from May to Scout, emitted exactly one review each, never selected Evaluation, and caused no storm. The Scout provenance skip made no model call, published no semantic report, and adds no assessed coverage. Automatic selection is now enabled at a serialized daily cadence; this proves a bounded rollout, not comprehensive App health.

## Boundary

Evaluation reviews an accepted outcome, not merely one worker session. The unit is an exact `(appId, taskId)` resolved through the Host's public control socket:

1. `apps.list` establishes that the subject App is registered.
2. `app.task.get` supplies the original input, acceptance, creator, generation, facts, and result.
3. `task.get(appId, taskId)` supplies resource version, status, bounded history, attempts, Conditions, and dependencies.
4. Both response envelopes and Task identities must match. The combined stable snapshot is hashed and passed to the evaluator.

The provider is bounded, read-only, timeout- and byte-limited. It neither opens SQLite nor imports private Host stores. Unknown ownership, identity mismatch, unavailable history, or read failure is `insufficient-evidence`: it is neither a target failure nor healthy coverage.

Evaluation-owned subjects are excluded. A Task created by Evaluation in another App is conservatively inconclusive when public provenance cannot distinguish reviewer delegation from independently owned remediation. A later Task owned and created by the external App remains eligible even when an Evaluation finding motivated it.

## Mechanical versus semantic work

Code owns catalog and Task identity checks, evidence binding, exclusion, stable hashing, pre-model reuse, stale-after-model recheck, immutable file naming, read-back, and event identity. The evaluator judges requested value, delegation, follow-up, recovery, verification, and delivery. Missing evidence is stated rather than scored as failure.

An unchanged accepted evidence hash reuses the existing report only after canonical report paths and on-disk subject identity are verified. A staged report may be republished after a publication failure without another model call. If the source changes while judgment runs, no report is published as current.

## Reports and use

Each successful review stages an immutable Markdown report and JSON facts sidecar under the configured durable `${EVALUATION_REPORT_ROOT:-${MAY_PERSIST_DIR:-/app/.state}/evaluation/reports}/task-outcomes/<app>/<rubric-version>/<task>-<evidence-hash>.*`, then emits `evaluation.task_report_published` with a stable Task-owned `localKey` and both content hashes. Only after that emit succeeds does it write an immutable `.published.json` marker. Listing and reading require the marker and revalidate the JSON identity, recorded JSON/Markdown hashes, and deterministically rendered Markdown bytes. A failed publish therefore leaves staged files undiscoverable, while a retry republishes the same validated bytes without another model call. A rubric change creates a new directory and deliberate assessment rather than overwriting history.

Reports are evidence, not commands or issue state. May should discover Evaluation through the normal App catalog and bounded Task list, inspect accepted review Task facts, and read the referenced report and sidecar. A human answer should state the covered subjects/time, a few material findings, missing evidence, exact report/evidence paths, and whether remediation is only delivered/acknowledged, claimed complete, or independently rechecked. Repeating a query reuses published reports; it does not automatically launch another evaluation. Responsible Apps receive exact findings through ordinary App inputs/Tasks and retain remediation results there.

## Cost and rollout

Initial rollout is serialized (`maxConcurrent: 1`) and automatic semantic sampling is off unless `EVALUATION_AUTO_REVIEW_ENABLED=true`. The selector chooses at most one outcome per wake: bounded `apps.list` discovers subjects, and public `tasks.list(appId, includeDone: true)` supplies recently updated navigation projections. Defaults cover seven days, at most 20 Tasks on each of two pages per visited App, and at most 20 external Apps. App rotation occurs after every selection. Versioned ordinary Task facts retain only the next App and a byte-bounded map of last-attempted Task identity digests; emitted requests retain the full identity, and legacy `app.tasks.list` cursors reset rather than crossing contracts. Malformed pages rotate neutrally. `up-to-date`, `closed`, `cancelled`, and `needs-attention` outcomes remain candidates while active `running`, `pending`, and `waiting` work does not; the evaluator, not selector code, interprets cancellation or failure meaning. Exact subject reads still validate external ownership and generation before any model call. Old outcomes remain explicitly reviewable. Selection/scoring thresholds remain guidance/configuration until trials justify enforcement.

The deterministic `list-evaluation-reports` and `read-evaluation-report` actions expose at most 5 valid published pairs and an 8 KiB content preview per read, keeping the complete Task result below the 16 KiB admission budget. Larger reports return exact size, SHA-256, canonical path, and explicit continuation metadata. Listing says each entry is one bounded Task snapshot and returns disposition plus relative action paths and canonical absolute artifact paths. Neither action invokes the evaluator or creates findings.

Activation must not awaken the retained legacy Evaluation backlog. The matching Host requires a string structural parent, so every supported input uses the surviving non-executable `evaluation-system` root group instead of a cancelled legacy subgroup. Canonical review, reader, and selector Task IDs remain stable; historical/manual compatibility inputs use fresh `runtime/compat/*` identities so they cannot revive cancelled Tasks. Session-only shallow/deep semantic entrypoints return neutral retired/insufficient-evidence results regardless of caller ownership hints; canonical Task-outcome review is the semantic path. Follow `rollout-and-migration-2026-09.md` for the exact 2,037-Task frozen retirement, staged canary, and rollback. Never delete Task or report history.
