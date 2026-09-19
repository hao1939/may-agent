# Task-outcome evaluation and report use

**Status:** The explicit single-Task review, durable report store, deterministic list/read path, legacy Task retirement, recent-window/fair-rotation selector, and report-discovery polish are deployed from App revision `79dd65e91f`. Four published reports—three assessed and one inconclusive—have an evaluator-session usage estimate of $0.479074; this is not a billing receipt, excludes May/reviewer costs, and is not report-recorded cost. A natural May query read the retained reports without a new evaluator run. Two bounded selector canaries rotated from May to Scout, emitted exactly one review each, never selected Evaluation, and caused no storm. The Scout provenance skip made no model call, published no semantic report, and adds no assessed coverage. Automatic selection was observed at a serialized daily cadence; this proves a bounded rollout, not comprehensive App health. The ongoing-assessment and latest-slot schedule changes described below are prepared candidate source, not observed activation.

## Boundary

Evaluation reviews an accepted outcome, not merely one worker session. The unit is an exact `(appId, taskId)` resolved through the Host's public control socket:

1. `apps.list` establishes that the subject App is registered.
2. `app.task.get` supplies the original input, acceptance, optional creator provenance, generation, facts, and result.
3. `task.get(appId, taskId)` supplies resource version, status, bounded history, attempts, Conditions, and dependencies.
4. Both response envelopes and Task identities must match. The combined stable snapshot is hashed and passed to the evaluator.

The provider is bounded, read-only, timeout- and byte-limited. It neither opens SQLite nor imports private Host stores. Unknown ownership, identity mismatch, unavailable history, or read failure is `insufficient-evidence`: it is neither a target failure nor healthy coverage.

The snapshot now includes `readBack`, following structured `{path, sha256}`
references through the shared Task evidence reader. This includes development
indexes, helper reports and raw verification receipts, not just their filenames.
Only explicit absolute pinned regular files are read; no directory scan, prose
path guessing, network fetch or transcript injection. JSON artifacts can expose
further pinned references. Missing, inaccessible, hash-mismatched, unpinned and
truncated evidence stays visible; oversized content is **not** presented as a
verified prefix. Limits per subject read are 12 artifacts, 32 KiB per artifact or
linked Task snapshot, 64 KiB combined consumed artifact/linked Task content,
4 linked Tasks, 2,000 scan nodes and depth 12. Existing public Task navigation
truncation is retained. Exact structured `{appId, taskId}` references and declared
dependencies use the existing public Task reader; Evaluation-owned links are
excluded. Remote-only, prose-only or over-budget references require a bounded
owner investigation, not a guessed read or failure verdict.

Artifact read-back proves the bytes consumed, not the truth of their claims or
independent recovery. The evaluator judges whether any gap is material to the
requested outcome; unread required evidence prevents claiming that outcome.
Read statuses, bytes and linked results are retained in immutable JSON reports
and participate in the evidence fingerprint, including the pre-publication
recheck. Newly readable evidence can therefore be reviewed without changing the
Task generation. The new `readBack.version` changes identity once, while the
existing rubric/path reader continues to read old immutable reports unchanged.
This costs bounded file/public reads even when an unchanged report is reused;
that is simpler than a second evidence cache and detects replaced/missing bytes.

Evaluation-owned subjects are excluded. Matching public App/Task identities establish the owning App; optional creator provenance identifies who initiated work, not who owns it. Creator-less historical/recurring Tasks remain readable without inventing a creator. Their missing creator/delegation provenance is retained in `readBack.gaps` for semantic judgment: eligibility to read is not proof of independent initiation, success, or healthy coverage. A Task created by Evaluation in another App is conservatively inconclusive when public provenance cannot distinguish reviewer delegation from independently owned remediation. A later Task owned and created by the external App remains eligible even when an Evaluation finding motivated it.

## Mechanical versus semantic work

Code owns catalog and Task identity checks, evidence binding, exclusion, stable hashing, pre-model reuse, stale-after-model recheck, immutable file naming, read-back, and event identity. The evaluator judges requested value, delegation, follow-up, recovery, verification, and delivery. Missing evidence is stated rather than scored as failure.

An unchanged accepted evidence hash reuses the existing report only after canonical report paths and on-disk subject identity are verified. A staged report may be republished after a publication failure without another model call. If the source changes while judgment runs, no report is published as current. Explicit post-adoption review carries the subject generation and evidence hash in both its input and deterministic Task identity. This keeps the exact-evidence outcome separate from an older generic review owned by another caller, reuses an identical pinned request, and makes generation or evidence drift insufficient evidence before model judgment or publication.

## Reports and use

Each successful review stages an immutable Markdown report and JSON facts sidecar under the configured durable `${EVALUATION_REPORT_ROOT:-${MAY_PERSIST_DIR:-/app/.state}/evaluation/reports}/task-outcomes/<app>/<rubric-version>/<task>-<evidence-hash>.*`, then emits `evaluation.task_report_published` with a stable Task-owned `localKey` and both content hashes. Only after that emit succeeds does it write an immutable `.published.json` marker. Listing and reading require the marker and revalidate the JSON identity, recorded JSON/Markdown hashes, and deterministically rendered Markdown bytes. A failed publish therefore leaves staged files undiscoverable, while a retry republishes the same validated bytes without another model call. A rubric change creates a new directory and deliberate assessment rather than overwriting history.

Reports are evidence, not commands or issue state. May should discover Evaluation through the normal App catalog and bounded Task list, inspect accepted review Task facts, and read the referenced report and sidecar. A human answer should state the covered subjects/time, a few material findings, missing evidence, exact report/evidence paths, and whether remediation is only delivered/acknowledged, claimed complete, or independently rechecked. Repeating a query reuses published reports; it does not automatically launch another evaluation. Responsible Apps receive exact findings through ordinary App inputs/Tasks and retain remediation results there.

May's intake rereads its current owner's accepted result through `ctx.read.tasks.get`.
An exact prior `evaluation-report-intake` result (including identical publication
hashes and subject) reuses its handoff or no-change disposition. If it carries a
`linkedTaskId`, that same-App owner is read before reuse; an unavailable link
stays unresolved instead of creating replacement work. Changed publication or
subject evidence does not reuse a stale conclusion. The workflow does not search
for semantically similar issues or infer recovery from terminal status; May owns
that judgment and should retain the accepted intake and exact owner link.

Before suggesting a repair, compare the historical finding with current accepted
Task evidence and any later recovery. A stale summary is not stronger evidence
than a later accepted, verified result; missing specialist evidence is a coverage
gap, not proof that the specialist did no work. Follow retained development report
indexes and exact artifact/commit references when public evidence exposes them.
If bounded reads still omit necessary evidence, state the limit rather than
quietly treating the report as complete.

Automatic preparation is a consumer responsibility described in
[Gym's improvement proposal](../../gym.app/design/report-driven-improvement.md).
The publication event carries the subject, evidence hash and report hashes;
it is not an owner acknowledgment, a repair assignment or promotion approval.
Read the published report through the supported interface, record the owner
decision and linked repair in ordinary Task results, and retain an independent
post-change recheck separately. Final human approval is required before applying
an automatically prepared improvement.

## Cost and rollout

Initial rollout is serialized (`maxConcurrent: 1`) and automatic semantic sampling is off unless `EVALUATION_AUTO_REVIEW_ENABLED=true`. The selector chooses at most one Task per wake: bounded `apps.list` discovers subjects, and public `tasks.list(appId, includeDone: true)` supplies keyset-ordered navigation projections. Each page requests one record and persists the returned opaque continuation after that record is considered; defaults allow two such reads per visited App and at most 20 external Apps. App rotation occurs after every selection. Versioned ordinary Task facts retain only the next App and byte-bounded public continuations; emitted requests retain the full identity, and older selector state resets rather than crossing traversal contracts. This removes attempted-identity history and its capacity-dependent starvation mode. Malformed pages rotate neutrally. `up-to-date`, `attention`, `closed`, `cancelled`, retained `done` receipts, and due `running`, `pending`, or `waiting` obligations can be candidates under their purpose-specific rubric; obsolete status spellings are not accepted. The evaluator, not selector code, interprets cancellation, waiting, or failure meaning. A prior report suppresses only the same decision-relevant evidence hash, purpose, validity identity, and rubric: the selector performs a bounded exact subject read before deduplicating, so changed evidence can produce another immutable review. Exact subject reads also exclude Evaluation-owned/self work before any model call. A report records the exact loaded definition source only if runtime context exposes it; this candidate explicitly records `unavailable:not-exposed-to-workflow` instead of trusting an unrelated environment label. This daily, one-candidate mechanism is sampling, not exhaustive or healthy coverage; cursor expiry may restart traversal, and explicit post-application follow-up must use an ordinary review Task instead. Old outcomes remain explicitly reviewable. The strengthening candidate leaves fair selector traversal unchanged and uses the Host's newest-first eight-attempt public window during review. When the opt-in flag is enabled, an exact `project.task.reconciled` outcome of `incomplete` or `retrying` can request an ongoing review without waiting for sampling; the reviewer still rereads current evidence and decides whether the obligation is stalled, legitimately waiting, or recovered. Other stalls retain bounded sampling latency.

The shared semantic allowance remains atomic. Its interval is configured separately by `EVALUATION_ASSESSMENT_ALLOWANCE_INTERVAL_MS` (default one day), so a faster selector cannot silently increase semantic spend; `EVALUATION_ASSESSMENT_CALLS_PER_INTERVAL` remains clamped to two. Retained requested review Tasks have priority over routine selection. The selector preserves its cursor and skips sampling while the complete App snapshot shows such work; a missing or truncated snapshot yields an explicit unknown-backlog coverage fact instead of a false empty claim. Already-running routine work is not preempted. Exhaustion is admitted as `waiting`, retaining exact subject generation, evidence hash, slot, limit and next eligibility. Its waiting result carries the Host's absolute `reviewAt`, not a synthetic Condition or event producer. Early wakes preserve that deadline and do not call the model; at eligibility the same exact request is reconsidered. Elapsed time never proves an external fact.

The deterministic `list-evaluation-reports` and `read-evaluation-report` actions expose at most 5 valid published pairs and an 8 KiB content preview per read, keeping the complete Task result below the 16 KiB admission budget. Larger reports return exact size, SHA-256, canonical path, and explicit continuation metadata. Listing says each entry is one bounded Task snapshot and returns disposition plus relative action paths and canonical absolute artifact paths. Neither action invokes the evaluator or creates findings.

Activation must not awaken the retained legacy Evaluation backlog. The matching Host requires a string structural parent, so every supported input uses the surviving non-executable `evaluation-system` root group instead of a cancelled legacy subgroup. Canonical review, reader, and selector Task IDs remain stable; historical/manual compatibility inputs use fresh `runtime/compat/*` identities so they cannot revive cancelled Tasks. Session-only shallow/deep semantic entrypoints return neutral retired/insufficient-evidence results regardless of caller ownership hints; canonical Task-outcome review is the semantic path. Follow `rollout-and-migration-2026-09.md` for the exact 2,037-Task frozen retirement, staged canary, and rollback. Never delete Task or report history.
