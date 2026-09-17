# Task-outcome evaluation and report use

**Status:** The explicit single-Task review path and its deterministic evidence/publication boundary are implemented in this candidate. Automatic semantic sampling, legacy Task retirement, report-query UX trials, and live activation remain rollout steps.

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

Each successful review writes an immutable Markdown report and JSON facts sidecar under `reports/task-outcomes/<app>/<task>-<evidence-hash>.*`, then emits `evaluation.task_report_published` with a stable Task-owned `localKey` and both content hashes. The accepted Evaluation Task result contains the subject, evidence hash, report paths, and evaluator execution identity.

Reports are evidence, not commands or issue state. May should discover Evaluation through the normal App catalog and bounded Task list, inspect accepted review Task facts, and read the referenced report and sidecar. A human answer should state the covered subjects/time, a few material findings, missing evidence, exact report/evidence paths, and whether remediation is only delivered/acknowledged, claimed complete, or independently rechecked. Repeating a query reuses published reports; it does not automatically launch another evaluation. Responsible Apps receive exact findings through ordinary App inputs/Tasks and retain remediation results there.

## Cost and rollout

Initial rollout is serialized (`maxConcurrent: 1`) and automatic semantic sampling is off. Explicit Task reviews calibrate model behavior first. A later bounded selector may choose at most one outcome per wake, rotate across the public App catalog, and checkpoint only after publication succeeds. Selection/scoring thresholds remain guidance/configuration until trials justify enforcement.

Activation must not awaken the retained legacy Evaluation backlog. Before enabling the App, classify and canonically cancel obsolete automatic/session-aftermath, self-review, deep-scan, canary, and superseded repair Tasks while preserving history. Retain unresolved explicit human requests in a reviewed manifest. Enable only Evaluation, run explicit May and Scout positive controls plus exclusion/failure/reuse/stale-publication controls, prove report discovery/read-back from May, then enable a deliberately bounded schedule. Roll back by restoring the prior release and disabling Evaluation; never delete Task or report history.
