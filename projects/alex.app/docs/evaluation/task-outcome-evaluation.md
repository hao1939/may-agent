# Task-outcome evaluation and report use

**Current operating profile (September 21):** The installed App uses the existing
single selector and serialized Evaluation lifecycle. Routine sampling explicitly
selects `evaluator-deepseek` at a five-minute selector/allowance cadence; Sol keeps
its hourly allowance for explicit and retained Sol reviews. Original caller waits
retain their saved deadlines until normal reconciliation considers them. A DeepSeek
report is a screening lead, not an authoritative current-health verdict: May must
verify material claims against current exact evidence, and no-finding does not
certify health. See [capacity for an active installation](#capacity-for-an-active-installation)
and the [rollout record](rollout-and-migration-2026-09.md#september-21-capacity-correction)
for the earlier Sol profile and transition limits.

**Initial rollout evidence (September 18):** App revision `79dd65e91f` established
explicit review, durable reports, deterministic list/read and fair selection.
Four reports had an evaluator-session usage estimate of $0.479074; that excludes
May/reviewer costs and is not a billing receipt. Two selector canaries rotated
from May to Scout without selecting Evaluation or causing a storm. The original
daily cadence was a bounded pilot and has been superseded for this installation.

## Boundary

**Observer evidence (activated September 30):** See the
[deployment and trial record](../../../sample.app/reviews/document-observation-2026-09-30.md).
Once a review
is selected and admitted within its existing allowance, its workflow reads
exact source Apps through public `apps.list {appId}` for unresolved observer
Conditions. Up to 16 interests and four source Apps are inspected. Current
observer run evidence and only the relevant resource checks accompany the
review; missing capabilities, failed reads and incomplete coverage remain
explicit. No private Host store access, new periodic task or repair lifecycle
is added. An old Host lacking this readout leaves coverage unknown.

These runtime samples are saved as `observerEvidence` in the immutable report,
separately from the canonical Task snapshot/hash. Every quiet provider poll
must not create a new Task evidence identity or consume another model review.
The captured runtime sample has its own timestamp and is not certified by the
Task freshness check. The evaluator checks run completion, resource success,
delivery and Task handling as different facts. Repeated ineffective owner
reviews or shared detector errors can justify a finding; the owner/May decides
the repair. A saved failure or report does not prove that May acted on it.
Evaluation remains independently supervised; it does not score itself.

Task control and HTTP reports must address the same Host installation. Set
`MAY_CONTROL_SOCKET` and `MAY_REPORT_BASE_URL` together when using a separate
instance, and keep its generated reports under its own `EVALUATION_REPORT_ROOT`.
These are Evaluation connection settings; the Host's public contracts and the
reader's identity checks are unchanged. A failed read remains a coverage gap,
with no fallback to a different installation.

**Population extension (September 27 candidate):** [Systemic pattern review](systemic-pattern-review-20260927.md)
adds bounded App-attempt aggregates and exact examples to this assessment path.
Current recovery and a remaining systemic concern are independent findings. The
implementation adds public attempt navigation and aggregate selection. See the
linked implementation/trial record for activation evidence and current limits.

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
path guessing or arbitrary network fetch. JSON artifacts can expose
further pinned references. Missing, inaccessible, hash-mismatched, unpinned and
truncated evidence stays visible; oversized content is **not** presented as a
verified prefix. Limits per subject read are 12 artifacts, 32 KiB per artifact or
linked Task snapshot, 64 KiB combined consumed artifact/linked Task content,
4 linked Tasks, 2,000 scan nodes and depth 12. Existing public Task navigation
truncation is retained. Exact structured `{appId, taskId}` references and declared
dependencies use the existing public Task reader; Evaluation-owned links are
excluded. Remote-only, prose-only or over-budget references require a bounded
owner investigation, not a guessed read or failure verdict.

### Bounded process evidence (activated September 22)

Source revision `6f7696bf7e4a8556800e5b16184c2a4eb9727345` was integrated and
loaded as definition release
`6f7696bf7e4a8556800e5b16184c2a4eb9727345-definitions-v4`. The three changed
Evaluation production files in that release match the integrated source
byte-for-byte. Activation used reload request event `6409383`, whose operation
`6409384` succeeded; Host source and the live Host binary were unchanged. A
later documentation-only commit does not change those active runtime bytes.

`readBack.process` follows up to three newest distinct `project.task.reconciled`
references in the public Task history, independent of waiting/completed status
or summary. Exact `event.get` verifies the historical reference. Public
`GET /api/task-attempts?appId=...&taskId=...&attemptId=...` supplies canonical
session/workflow links; the event's `workflowRunId` is not a session identity. Public GET `/api/sessions/<id>` must match App,
Task, generation and attempt, identify a non-Evaluation worker, and be terminal.
Its binding is checked again after the transcript and any exact raw-result reads. Missing,
mismatched, active or workflow-shaped execution is explicitly unassessed; no
session directory scan or guesses from result strings. A later no-op does not
hide earlier work inside this window; work outside the window remains unassessed.

Each HTTP read uses `MAY_REPORT_BASE_URL` (default `http://localhost:8080`), a five-second
timeout and one-megabyte response cap. Installations without that endpoint report
unavailable coverage, not a failed wait. **The Host still parses the whole raw file
server-side**, and its public projection omits some message kinds and caps tool
results at 2,000 characters. Client bounds do not fix or conceal that Host cost.
For up to three error results across the process window whose projected text exceeds 800
characters, Evaluation reads `GET /api/sessions/<id>/raw-log?line=<rawLine>`.
The extra reads share a five-second client deadline, passed as the remaining
timeout to each request. Their count bounds extra Host full-file reads to three;
client cancellation does not stop an already running Host file parse.
Session, source, line, tool-call identity, tool name, error flag and the projected
prefix must match. The snapshot retains the result's beginning and end within
800 characters, marks the omitted middle, and hashes the complete raw result.
This preserves partial output alongside a terminal diagnostic. A missing,
mismatched or over-limit raw read leaves the original projection and error flag
available, with an explicit evidence gap. It does not suppress the attempt.
Each attempt retains at most 96 messages, 800 characters per field, eight calls
per message and 64 KiB of projection. Raw line/source/block coordinates and
hashed tool-call IDs preserve call/result correlation without copying long
provider tokens. The public response hash detects drift even outside a clipped
field; it is not a hash of the original raw transcript. Exact expanded errors
also retain their raw-result hash, including bytes omitted from both excerpts.
Truncation is explicit. Acquisition budgets are kept outside the hashed snapshot;
subjects without long errors retain their prior evidence identity and cache reuse.
No child execution is inferred. Relative artifact references remain unavailable.

The existing review snapshot hash, freshness reread, immutable publication and
May intake include this bundle. The existing judgment schema is unchanged:
summary/findings/verification/delivery distinguish current wait, delivered work,
process efficiency and coverage. A coherent wait does not suppress inspection of
completed work, and a process gap does not invalidate the wait. Counts, isolated
errors, successful output, necessary exploration, recovery and valid no-ops are
not automatic efficiency findings. The evaluator judges waste against practical
value/cost and cites exact attempt/session/line evidence, or states its limits.

The [September 30 comparison](../../archive/retired-apps/evaluation/experiments/evidence-judgment-20260930/README.md)
found a remaining judgment limit: an error flag and call ordering can reach the
evaluator while its report still overlooks or misstates them. Two isolated
criteria revisions and a presentation-order trial did not establish a reliable
correction. The experiment retains negative results, fixture limitations and
independent May/Gym review; passing source checks alone is not evidence for
promoting new judgment guidance.

This adds at most three event and 12 HTTP reads per subject snapshot: nine
metadata/transcript reads and up to three exact error reads (the review rereads
freshness), plus bounded prompt bytes; no new controller or
scoring scheme. Prompt-only and latest-session-only changes cannot address the
observed missing-process/no-op gap. A Host accepted-attempt execution link and
server-bounded transcript endpoint may simplify this later; they are not needed
to expose the saved cycle through today's public chain and are not implemented
here. Before activation, independent tech-lead review and focused/full/design checks
passed. Bounded DeepSeek trials used the existing assessment schema on the saved
hygiene subject plus two controls. The subject trial cited the meaningful attempt,
its later no-op, concrete tool evidence and explicit truncation/unavailable-artifact
limits. The direct control judged one authoritative read proportionate; the recovery
control judged one documented fallback after a transient 503 proportionate. These
trials demonstrate evidence delivery and evaluator discretion, not exhaustive
history coverage or a general proof that exploration was necessary or first-time.
Provider usage is retained in the rollout artifacts; zero cost totals mean tariff
estimation was unavailable because the current registry rates are unknown, not that
execution was free or configured pricing was zero.

The first post-activation request mistakenly pinned subject generation 1 even though
the saved baseline and current Task were already generation 2. The existing reader
correctly rejected that stale supplied identity. Its generation-2 successor
retained the identical evidence hash, waited for the normal DeepSeek allowance,
and then published a current immutable report. The normal May intake verified the
report hashes, reread the subject, and returned the report for investigation. May's
bounded judgment accepted the demonstrated value: the report independently kept
the valid wait, duplicate no-op, completed 12:00 contribution, and process
proportionality distinct. It found no material waste in the three-attempt window and
therefore authorized no hygiene-code repair. The exact publication, intake run and
judgment are retained in the rollout record. This live proof does not make the
three-attempt window exhaustive, fix unavailable or mismatched artifacts, establish
the model's broader claim that exploration was necessary or first-time, or authorize
future automatic application.

Artifact read-back proves the bytes consumed, not the truth of their claims or
independent recovery. The evaluator judges whether any gap is material to the
requested outcome; unread required evidence prevents claiming that outcome.
Read statuses, bytes and decision-relevant linked results are retained in
immutable JSON reports and participate in the evidence fingerprint, including
the pre-publication recheck. Canonical creator identity and navigation remain in
the subject `appTask`, but the reader does not recursively fetch that creator's
mutable Task merely because it is provenance; unrelated creator work therefore
does not redefine the subject's evidence or consume its linked-read budget.
Declared dependencies and exact helper/result references remain evidence links.
If the creator Task is also cited by one of those independent references, it is
followed normally; only the known Host provenance occurrence is skipped, not
creator-named objects inside arbitrary domain results. Newly readable evidence
can therefore be reviewed without changing the Task generation. Existing
immutable reports and legacy reads remain unchanged. This costs bounded
file/public reads even when an unchanged report is reused; that is simpler than
a second evidence cache and detects replaced/missing bytes.

Evaluation-owned subjects are excluded. Matching public App/Task identities establish the owning App; optional creator provenance identifies who initiated work, not who owns it. Creator-less historical/recurring Tasks remain readable without inventing a creator. Their missing creator/delegation provenance is retained in `readBack.gaps` for semantic judgment: eligibility to read is not proof of independent initiation, success, or healthy coverage. A Task created by Evaluation in another App is conservatively inconclusive when public provenance cannot distinguish reviewer delegation from independently owned remediation. A later Task owned and created by the external App remains eligible even when an Evaluation finding motivated it.

## Mechanical versus semantic work

Code owns catalog and Task identity checks, evidence binding, exclusion, stable hashing, pre-model reuse, post-model freshness recheck, immutable file naming, read-back, and event identity. The evaluator judges requested value, delegation, follow-up, recovery, verification, and delivery. Missing evidence is stated rather than scored as failure.

An unchanged accepted evidence hash reuses the existing report only after canonical report paths and on-disk subject identity are verified. A staged report may be republished after a publication failure without another model call. A reviewer execution that does not return a schema-valid judgment remains an unfinished workflow result, preserving its exact execution and allowance facts; it is not converted into a successful `evaluator-failed` disposition. Ordinary Task recovery retries the same review, and the already consumed semantic allowance may truthfully defer that retry to its normal boundary. By contrast, schema-valid adverse and `insufficient-evidence` judgments are successful assessments and still publish normally. If the source changes while judgment runs, Evaluation retains and publishes the judgment against the immutable inspected snapshot, with snapshot identity and the later freshness check recorded separately. It never relabels that report as current. Report listing and exact reads continue to expose the historical judgment; May intake classifies current versus stale and returns stale reports with current evidence for explicit relevance and value judgment. A historical report cannot by itself authorize action or certify present health, but later subject progress does not erase its scoped judgment or invalidate independently authorized candidate, approval, application, or activation work. Explicit post-adoption review carries the subject generation and evidence hash in both its input and deterministic Task identity. Generation or evidence drift before model judgment remains `insufficient-evidence`; drift during judgment preserves the already-paid-for historical assessment without turning it into a present-tense health claim.

Automatic review requests retain `automatic: true` in their normalized Task contract; explicit action callers cannot set that internal field. If canonical subject acquisition itself throws before assessment (for example, `apps.list` is unavailable or an endpoint identity is malformed), the review still returns its SDK-admissible neutral `insufficient-evidence` result and makes no model call or report. In addition, it sends the exact bounded failure through the existing `evaluation.review_failed` route. That route keeps `runtime/compat/owner-review` as one standing desired Task with stable input; each exact failure remains durable in the admitted trigger/reconciliation event batch. Distinct failures and routine wakes therefore do not revise the Task generation or fence active owner work, while unfinished evidence is replayed to a later reconciliation attempt until settlement consumes it. Evaluation's accountable owner must consider the local acquisition exception rather than relying on an absent external caller or pretending a report was published. The automatic marker is part of review Task identity, keeping an explicit caller's obligation independent. Supported exclusions, catalog absence, Evaluation-worker provenance, and other reached neutral decisions do not produce owner work; successful and partial-evidence assessments continue through ordinary immutable report publication and May intake. This is an owner-feedback connection, not a new retry queue, monitor, lifecycle, target failure, or fabricated report.

The unfinished result must pass the same SDK admission as any other Task result:
return `incomplete` with execution facts and omit new actions, Conditions and
dependencies. Even an empty `actions` field is outside that existing contract.
This does not clear previously saved waits or obligations. The failure regression
checks the workflow output through SDK admission before checking allowance deferral.
The [deferred-review trial](../../archive/retired-apps/may-agent/experiments/recovery-workflow-20260922/BUDGET-RESUME.md)
records automatic timer, failure, publication and delivery checks separately from
model judgment quality.

### Operational feedback for Evaluation's own failures

The existing `project.task.reconciled` subscription returns `incomplete` and
`retrying` facts for Tasks owned by Evaluation to the same standing
`runtime/compat/owner-review` Task used by `evaluation.review_failed`. The exact
Task, generation, attempt and failure remain in its durable trigger context;
its desired input stays stable. This is operational ownership, separate from
semantic assessment: Evaluation still excludes itself as an assessment subject.
Local failure feedback does not depend on the external automatic-assessment
flag or spend that lane's semantic allowance.

The owner groups repeated notices by exact affected local Task identity and reads
each current affected Task once before choosing an action. For
`project.task.reconciled`, that identity is `{project (or appId), taskId}`. For
`evaluation.review_failed`, it is `{evaluation, reviewTaskId, reviewGeneration}`;
the payload's `{appId, taskId}` identifies the external assessment subject and
must not become Evaluation remediation work. A missing or unreadable local
identity remains an explicit evidence gap. The standing
`runtime/compat/owner-review` Task is the inbox and settlement boundary; its own
resource version does not establish an affected incident's current state. Failed
attempt history and current target state remain distinct. Normal retry, waiting
and later verified recovery remain valid: a recovered incident can need no
intervention, a persistent failure can merit investigation and must retain its
obstacle and next step, and an unavailable affected-Task read remains an explicit
evidence gap. The event is historical evidence, not a command to unblock,
reassign or create a repair. Unhandled meaning must remain in the owner's accepted
result as an explicit obstacle, next step or existing linked work.

An owner-review failure uses its existing Task retry and retained input; this
subscription does not recursively wake that same owner. `converged`, `waiting`
and `progress` results add no failure review. A missing/broken App that cannot
produce a reconciliation event is outside this connection. Automatic supervisor
fallback remains uninstalled; there is no claim that recording such a failure
notified May or a human. No timer, queue, new workflow or Host recovery rule is
introduced. The source trial and limitations are retained in the
[owner feedback review](../../archive/retired-apps/evaluation/experiments/owner-feedback-20260928/README.md).

### Review-request identity and retained collision recovery

A review Task represents the normalized assessment contract, not only the target
Task. Version 2 identities have the deterministic shape
`runtime/task-outcome/v2/<app>/<task>/<purpose>[/generation-N][/evidence-H]/contract-<sha256>`.
The final full digest binds the canonical normalized input and prevents the
readable, lossy path labels from becoming identity authority. `purpose` is always
`outcome` or `ongoing`; omitted purpose normalizes to `outcome` in both identity
and workflow input. Generation and evidence pins are independent optional
attributes. Neither suppresses the other, because the workflow validates each
independently and partial pins have distinct meaning. The identity is derived
only from the request, never from mutable current target state. Exact replay
therefore retains one Task and complete requirements, while any changed target,
purpose or pin selects different work.

`subjectGeneration`, when present, is a positive safe integer in both the App
input and the `review-task-outcome` action input. Both declarations reuse one
schema field, matching the Task mapper's retained identity: omission remains a
valid unpinned review, while zero, fractional, and unsafe numeric values are
rejected at admission instead of being accepted and silently omitted from the
review identity.

The explicit `v2` namespace is the bounded upgrade for the retained historical
collision where a valid generation-only ongoing review occupied the old unpinned
identity. Normal inbox recovery remaps still-pending unpinned inputs to the new
namespace; their equivalent contracts share one new Task. The old Task is not
revised, migrated, cleared, or assigned a new creator, so its original caller
links, accepted evidence and budget-deferred wait remain authoritative. This
small namespace correction costs a one-time identity change for future review
admissions, including contracts that never collided. It is preferable to a
compatibility registry, whole-archive scan, or creator-owned rewrite: those add
state and authority risk merely to preserve obsolete mapper identities. Existing
immutable reports remain reusable because report lookup and the semantic
allowance are keyed by subject evidence and publication identity, not this Task
namespace.

A fixture that seeds the collided Task and saved inbox rows, then runs ordinary
`recoverAdmissions`, proves source mapping, admission idempotency and retained
state preservation. It does not prove that deployed source recovered live rows,
that a semantic report was produced, or that allowance was available. Those
claims require separate live admission and report observations after activation.
The upgrade deliberately handles retained pending inputs visible to bounded
inbox recovery; it does not scan or rewrite completed historical inputs or the
Task archive.

## Choosing verification evidence

A deterministic reader repair is established primarily with focused source,
compatibility, budget and production-path checks. A frozen Gym/model comparison
is useful when the proposed benefit depends on uncertain reviewer behavior; it
is evidence for that uncertainty, not a mandatory extra gate for every
mechanical correction. Keep the two claims separate: deterministic checks prove
the reader contract, while model trials can only sample what richer evidence
changes in judgments.

## Reports and use

Review reuse follows decision-relevant evidence. Routine
`project.task.reconcile.skipped` checks do not create a new identity for either
the subject or a linked Task. They remain available in the event log; the bounded
Task work history reserves its space for actual changes and attempts. Evaluation
also filters these checks when reading older Hosts. It does not recursively
strip App-authored fields: changed requirements, accepted results, failures,
Conditions and review deadlines still invalidate the relevant assessment.
This keeps quiet waits inexpensive without treating an old report as proof of
new work. Restoring previously evicted process evidence can cause one fresh
assessment when the Host history fix is activated.


Each successful review stages an immutable Markdown report and JSON facts sidecar under the configured durable `${EVALUATION_REPORT_ROOT:-${MAY_PERSIST_DIR:-/app/.state}/evaluation/reports}/task-outcomes/<app>/<rubric-version>/<task>-<evidence-hash>.*`, then emits `evaluation.task_report_published` with a stable Task-owned `localKey` and both content hashes. The reviewer returns only its schema-valid judgment; it does not write report files. `assessed` and `insufficient-evidence` are successful judgments, including when they contain adverse findings. Reviewer execution is partial or failed only when the reviewer itself cannot complete. The workflow exclusively validates, writes, reads back, and publishes canonical reports. Only after the emit succeeds does it write an immutable `.published.json` marker. Listing and reading require the marker and revalidate the JSON identity, recorded JSON/Markdown hashes, and deterministically rendered Markdown bytes. A failed publish therefore leaves staged files undiscoverable, while a retry republishes the same validated bytes without another model call. A rubric change creates a new directory and deliberate assessment rather than overwriting history.

Reports are evidence, not commands or issue state. May should discover Evaluation through the normal App catalog and bounded Task list, inspect accepted review Task facts, and read the referenced report and sidecar. A human answer should state the covered subjects/time, a few material findings, missing evidence, exact report/evidence paths, and whether remediation is only delivered/acknowledged, claimed complete, or independently rechecked. Repeating a query reuses published reports; it does not automatically launch another evaluation. Responsible Apps receive exact findings through ordinary App inputs/Tasks and retain remediation results there.

An actionable finding includes a recommendation ready for owner judgment:
observed impact and evidence, supported cause or exact uncertainty, the smallest
useful correction or investigation, its owner, benefit versus cost, and how to
verify the result. A no-change recommendation is valid. The shared
[report criteria](../../criteria/criteria.md#findings-and-recommendations) apply to
both Task and metric reviews through their existing report fields; no schema,
queue or automatic repair authority is added. May checks current relevance and
accepts or declines the proposal, or requests specific missing evidence.
Technical investigation and implementation remain ordinary work for the
accountable App and its specialists. Evaluation later assesses the resulting
work independently; accepting a proposal does not establish success or replace
the existing human approval required for applying an automatic improvement.

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
[Gym's improvement proposal](../comparison/report-driven-improvement.md).
The publication event carries the subject, evidence hash and report hashes;
it is not an owner acknowledgment, a repair assignment or promotion approval.
Read the published report through the supported interface, record the owner
decision and linked repair in ordinary Task results, and retain an independent
post-change recheck separately. Final human approval is required before applying
an automatically prepared improvement.

## Cost and rollout

For ongoing assessments, validity is derived only from supported current scheduling authority: unresolved Condition observation plus `reviewAfterMs`, the exact Task's authoritative `currentObligations.reviewAt`, and each retained input wait's `reviewAt`. These boundaries are sorted but remain independent, so crossing an earlier deadline does not erase a later one and renewing one wait changes the validity identity. An available obligation ledger with no deadline remains `unknown`; rolling recurrence presentation fields and arbitrary result data are not scheduling authority.

Initial rollout is serialized (`maxConcurrent: 1`) and automatic semantic sampling is off unless `EVALUATION_AUTO_REVIEW_ENABLED=true`. The selector chooses at most one Task per wake: bounded `apps.list` discovers subjects across every external App, canonicalizes `.app` names, and excludes Evaluation without a pilot allowlist. It traverses the existing public indexed `tasks.list` filter for `pending`, `waiting`, and `attention` as a finite pass with a byte-bounded opaque keyset cursor, gives one bounded turn to the historical `includeDone: true` cursor when that pass ends, then starts the unresolved view from its head again. `running` remains in historical traversal so Evaluation publication-processing Conversations do not crowd out explicit waits merely by changing on every report. This shared rule applies to both reviewer profiles; reviewer identity controls allowance and report namespace, not selection fairness. Each lane advances before return, so dropped reviews do not prevent eventual traversal. The historical cursor is preserved across unresolved refreshes. A new wait inserted ahead of an active unresolved cursor is intentionally reached on the next finite pass rather than preempting older unresolved work; exact failure events remain the immediate admission path, and workload evidence can justify revisiting this latency tradeoff later. Defaults allow two reads per lane per visited App and at most 20 external Apps. App rotation occurs after every selection. Versioned ordinary Task facts retain only the next App plus both cursor maps and an out-of-band filtered-pass exhaustion marker; the three navigation maps share one aggregate 6KB budget, and the complete admitted result retains its separate 16KB bound. No cursor string is reserved as a sentinel. Version-5 historical cursor state migrates while the new filtered cursor and phase start empty. Emitted requests retain the full identity. This uses no attempted-identity history or scheduling counter. Malformed pages rotate neutrally. `up-to-date`, `attention`, `closed`, `cancelled`, retained `done` receipts, and due `running`, `pending`, or `waiting` obligations can be candidates under their purpose-specific rubric; obsolete status spellings are not accepted. The evaluator, not selector code, interprets cancellation, waiting, or failure meaning. A prior report suppresses only the same decision-relevant evidence hash, purpose, validity identity, and rubric: the selector performs a bounded exact subject read before deduplicating, so changed evidence can produce another immutable review. Exact subject reads also exclude Evaluation-owned/self work before any model call. A report records the exact loaded definition source only if runtime context exposes it; this candidate explicitly records `unavailable:not-exposed-to-workflow` instead of trusting an unrelated environment label. This one-candidate mechanism is sampling, not exhaustive or healthy coverage; cursor expiry may restart traversal, and explicit post-application follow-up must use an ordinary review Task instead. Old outcomes remain explicitly reviewable. Exact current reads stay compact and advertise accepted-attempt availability; the pinned-evidence consumer explicitly follows bounded newest-first pages (up to 128 records per review, with continuation and truncation gaps retained) so older artifact references do not become undiscoverable after later wait-only results. When the opt-in flag is enabled, an exact `project.task.reconciled` outcome of `incomplete` or `retrying` can request an ongoing review without waiting for sampling. New automatic failure requests use the same configured automatic reviewer as the selector; explicit requests preserve their requested reviewer, and retained Sol Tasks are not rewritten. The reviewer still rereads current evidence and decides whether the obligation is stalled, legitimately waiting, or recovered. Other stalls retain bounded sampling latency.

Automatic selection and automatic review execution share one subject-eligibility
rule over the canonical retained App Task input. An Alex Task whose original
`message` input carries `context.event.type` equal to
`evaluation.task_report_published` or `evaluation.metric_report_published` is a
report-disposition Task: it remains useful owner judgment, but automatic review
excludes it because another report would only create another disposition. This
is not an App-wide or descendant exclusion. A separately admitted goal,
implementation, or recovery Task remains eligible even when its structured
context cites the Evaluation finding, and Alex work generally remains reviewable.
An explicit caller-requested `review-task-outcome` without the internal
`automatic: true` marker may deliberately review a disposition Task. Thus the
rule suppresses the mechanical report → disposition → report loop without a
registry, ancestry walk, name convention, or review-depth counter and without
weakening human-requested oversight.

Population sampling retains one bounded per-App checkpoint in the same selector
state. The checkpoint combines the latest observed hourly cut with the last selected evidence digest of
the full public population report after removing only the top-level cut and each
cohort's `start`/`end` window coordinates. A later cut with otherwise identical
evidence advances the checkpoint but does not request another model assessment;
ordinary Task traversal, explicit requests, due obligations, and changed Task
evidence remain independent. Attempt identities, outcomes, failure reasons,
example timestamps, handler/failure groups, truncation flags, limits, and
coverage text all remain digest inputs, so equal counts do not hide a different
failure or cohort. A legacy cut-only checkpoint is intentionally treated as
having no prior digest and receives one normal selection before deduplication.
An unavailable or ineligible representative does not advance the selected-evidence
digest, so a later normal observation can retry that undelivered review.
This avoids a clock-only repeat without creating a report registry or claiming
that counts alone establish an unchanged population.

Each fixed reviewer profile has an atomic semantic allowance independent from selector cadence. Routine review of the same metric is daily for both profiles; breach and recovery transitions request immediate review subject to the shared capacity. The App mapper must retain the exact positive `alertId` and observation cutoff through Task admission and report publication. Otherwise a new episode is incorrectly treated as routine work under the previous cooldown. Replaying a transition reuses that episode's retained report; new samples and repeat breach notifications remain quiet. Already-consumed transitions require explicit recovery under their original alert identity; changing future routing alone does not reassess them. Repeated samples update evidence without creating new reviews. The default `evaluator` (Sol) counter uses `EVALUATION_ASSESSMENT_ALLOWANCE_INTERVAL_MS` and `EVALUATION_ASSESSMENT_CALLS_PER_INTERVAL`; its source fallback remains the legacy one day, while the current rollout explicitly retains the existing one-hour environment setting. The dedicated `evaluator-deepseek` counter uses a separate receipt namespace plus `EVALUATION_DEEPSEEK_ALLOWANCE_INTERVAL_MS` (default five minutes) and `EVALUATION_DEEPSEEK_CALLS_PER_INTERVAL`. Both limits remain clamped to two, and App `maxConcurrent: 1` serializes execution. Retained requested review Tasks have priority only within the selected reviewer's capacity: DeepSeek requests defer routine DeepSeek sampling, while a Sol-only deferred request does not stop DeepSeek progress. The selector preserves its cursor when it defers; a missing or truncated snapshot yields an explicit unknown-backlog coverage fact instead of a false empty claim. Already-running work is not preempted. Exhaustion is admitted as `waiting`, retaining exact subject generation, evidence hash, reviewer, slot, limit and next eligibility. Its waiting result carries the Host's absolute `reviewAt`, not a synthetic Condition or event producer. Early wakes preserve that deadline and do not call the model; at eligibility the same exact request is reconsidered. Elapsed time never proves an external fact.

### Capacity for an active installation

The daily one-call default is an initial sampling profile, not a suitable promise
of timely assessment for an active installation. On September 21 the live
installation retained 23 budget-deferred review contracts across 20 subjects;
routine selection correctly yielded to that backlog. Increasing selector cadence
alone cannot repair that capacity mismatch.

Use the existing installation settings to select an explicit review budget. The
reviewed operational profile is an hourly selector and one semantic assessment per
hour: `EVALUATION_AUTO_REVIEW_INTERVAL_MS=3600000`,
`EVALUATION_ASSESSMENT_ALLOWANCE_INTERVAL_MS=3600000`, and
`EVALUATION_ASSESSMENT_CALLS_PER_INTERVAL=1`, with serialized execution unchanged.
This permits at most 24 semantic assessments per UTC day once active. The earlier
four-call calibration suggests roughly $2.87/day at full use, excluding owner and
reviewer work; this is a planning estimate, not a billing cap. Report reuse,
self-exclusion, exact request identity, and requested-review precedence remain
unchanged. A queue can still delay an individual review; this is bounded coverage,
not an immediate-response or exhaustive-health guarantee.

A budget change does not rewrite existing per-input waits. Let the original
requests reach their recorded deadline and adopt the new allowance through normal
reconciliation. If a report is needed sooner, an ordinary input addressed to the
same Task can produce or reuse one under the new budget, but its completion does
not answer another input whose independent wait was not considered. Preserve exact
caller links and pins; neither identical workflow parameters nor a newly published
report authorizes blanket completion of unrelated input waits.

Verify consumed process settings, report production/read-back and enforcement of
the next allowance boundary separately from completion of each original caller.
The September 21 trial demonstrated this distinction: early follow-ups advanced
their own eligibility, while original daily waits remained. Allow that bounded
transition instead of rewriting storage, resetting receipts or adding an override
controller. Future capacity changes should use observed backlog, report usefulness
and cost.
The deterministic `list-evaluation-reports` and `read-evaluation-report` actions expose at most 5 valid published pairs and an 8 KiB content preview per read, keeping the complete Task result below the 16 KiB admission budget. Larger reports return exact size, SHA-256, canonical path, and explicit continuation metadata. Listing says each entry is one bounded Task snapshot and returns disposition plus relative action paths and canonical absolute artifact paths. Neither action invokes the evaluator or creates findings.

Activation must not awaken the retained legacy Evaluation backlog. The matching Host requires a string structural parent, so every supported input uses the surviving non-executable `evaluation-system` root group instead of a cancelled legacy subgroup. Canonical review, reader, and selector Task IDs remain stable; historical/manual compatibility inputs use fresh `runtime/compat/*` identities so they cannot revive cancelled Tasks. Session-only shallow/deep semantic entrypoints return neutral retired/insufficient-evidence results regardless of caller ownership hints; canonical Task-outcome review is the semantic path. Follow `rollout-and-migration-2026-09.md` for the exact 2,037-Task frozen retirement, staged canary, and rollback. Never delete Task or report history.

### Historical selector input repair

An exact `reconcile-automatic-review-inputs` request names up to eight original
automatic-review inputs. The selector verifies their canonical admissions and a
later accepted selector decision before explicitly answering those inputs. This
App judgment concerns redundant selection opportunities; it does not claim that
every metric incident was fixed or every requested semantic review was performed.
The Host persists the exact answer links. Repair emits no new review or report.

Repair-only results are not selection decisions. If they fill the newest evidence
page, follow the existing accepted-evidence continuation, up to the ordinary
128-record navigation budget. A missing decision leaves the request incomplete;
if more evidence remains, retain its next cursor for owner investigation. Reading
a bounded prefix never proves the older decision is absent. Repair stays explicit
and scoped; ordinary selection does not sweep or replay historical requests.

### Listing retained reports

The report reader returns the newest valid published reports across all App and
reviewer directories. The result limit bounds returned entries, not a prefix of
the filesystem traversal. Each publication still passes the existing marker,
identity and byte-integrity checks; exact reads use the same authority. Without
a complete report index, listing traverses the retained marker tree and keeps
only the requested newest entries (at most 100). This costs work proportional to
the retained store; it must not silently omit newer reports to save that work.
Reading reports never triggers another model evaluation.
