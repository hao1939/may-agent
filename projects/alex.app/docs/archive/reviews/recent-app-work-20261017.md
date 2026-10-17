# Recent App work: useful output and repeated judgment — October 17

**Supports:** [Execution feedback and agent wakes](../../2a-design/execution-feedback.md)
and [hierarchical recovery](../../proposals/unified-agent-recovery-20261017.md).
Checks whether execution produces useful work and whether repeated judgment
has a decision to make. This is a read-only runtime review, not a rollout.

## Conclusion

The active Apps produce real research, repairs and verified continuation.
Their effectiveness is uneven: repeated evaluation of unchanged obligations,
metric threshold oscillation and Reddit's recurring access review still consume
model work without advancing the assignment. One exact duplicate PR observation
also reached a model. The dominant common issue is treating new observation
bytes as a reason for new judgment without checking their relevance to the
owned outcome or the previous decision's reconsideration conditions.

Do not classify all scheduled work, large context, accepted waits or repeated
attempts as waste. Scout's scans often found new evidence; a May repair Task
combined actual fixes, human corrections, review events and an explicitly
requested continuation trial. Ordinary code workflows also run without models.

## Scope and accounting

- Window: **2026-10-16 10:13:15 to October 17 10:13:15 UTC**, or
  **October 16 18:13:15 to October 17 18:13:15 China time**.
- Runtime observed: healthy `may-agent v5.5.0 (980f2cda)`; current container
  started at October 17 06:40:11.638 UTC. The 24-hour window includes roughly
  ten hours of runtime silence. This is not a continuous-availability sample.
- Current App release at collection:
  `697cc6c655c8c9e2cc02c0a0194abe220e6aae73-definitions-v5`.
  Earlier sessions retain their own release snapshots.
- Indexed, bounded, read-only queries collected 319 execution-usage records,
  319 corresponding sessions and 364 workflows. Selected Task identities
  yielded 325 retained attempts across 102 Tasks. Retained attempt history is
  not necessarily a complete history of every older generation.
- All 319 executions belong to Alex, May or Scout. Historical rows for retired
  Apps, including an old AKS Task marked running, do not establish live work.

| App | Model executions | Uncached input | Cache reads | Cache writes | Output |
| --- | ---: | ---: | ---: | ---: | ---: |
| Alex, including its team | 189 | 13,919,526 | 50,691,970 | 10,401,991 | 1,156,094 |
| May | 81 | 7,556,645 | 36,222,893 | 2,154,554 | 312,535 |
| Scout | 49 | 2,936,812 | 12,327,898 | 1,871,825 | 181,413 |
| Total | 319 | 24,412,983 | 99,242,761 | 14,428,370 | 1,650,042 |

These are cumulative provider-reported token counts across replies. The Host
normalizes input to exclude cache reads and writes; their sum with output is
139,734,156 tokens. It is neither unique context nor a bill. One of 2,281 replies
has no measured usage, and 486 measured DeepSeek replies have no price estimate;
zero recorded DeepSeek cost must not be reported as free execution.

Since the current container started, 120 executions occurred before the cutoff:
71 Alex/team, 36 May and 13 Scout. Across the full window, 312 sessions ended
done, six interrupted and one error. These statuses establish execution
outcomes, not semantic usefulness.

## Finding 1: unrelated producer activity invalidates an old review

Alex Task `input/app_c16ddfaa-d95f-4c03-bbfa-9a89ab326132` was assessed eight
times by Evaluator-DeepSeek. The reports repeatedly found a coherent wait for
the same human review/waiver decision concerning PR #361, with no new
intervention requested. Those eight executions used **1,780,201 recorded
tokens**, including 1,048,384 cache reads. This is the whole review cohort,
not a claim that every token in it was avoidable.

The latest pair isolates a concrete source of unnecessary reconsideration:

| Report | Evidence hash | Execution |
| --- | --- | --- |
| October 17 08:55 UTC review | `29a3b6731a0c5ec54fed9ba4d1be6cf6ac41df76c3b9343b133d5d3b738ddeaa` | `s_1792227309280_51760b0c-3358-4b80-a8fd-ca4f7b96a043` |
| October 17 10:10 UTC review | `fcbf56b3a128d9b90c3f6994caad0602e84376df065a1638ac3802b2c18db769` | `s_1792231834847_8b467de5-1029-42a7-93ba-42be02659062` |

The two saved reports have identical parsed `evidence.appTask` and
`evidence.detail`. Their two May dependency readbacks are identical. Artifacts,
process evidence, gaps and validity identity are also unchanged. Only
`readBack.links[2]`, the ongoing Scout `explore-github` Task, changed: its latest
research moved from Minerva to Memoria. That does not change Alex's old pinned
finding, accepted contribution or human wait.

Installed `public-task-evidence.ts::taskEvidenceHash` includes linked Task
readbacks, and `task-outcome-selector.ts::needsReview` selects a new hash for
assessment. `pinned-task-evidence.ts` already excludes the canonical creator
object from live Task traversal, but other structured references still bring
this producer into the review evidence.

**Owner and correction:** Alex's App evaluation evidence/selection policy.
Bind a review to the specific contribution, artifact and awaited facts that
matter to its assignment. Keep producer navigation available without making
unrelated future work invalidate the decision. Verify both quiet unrelated
updates and renewed assessment when an actual dependency or decision changes.

## Finding 2: metric transitions repeatedly commission the same judgment

`metric.source-query-worst-ms` received **14 model reviews** in the window,
using **3,299,351 recorded tokens**. The first reviews identified real spikes
and requested investigation. After the accepted owner disposition, the last
**10 consecutive reviews**, from 07:50 to 10:06 UTC, returned
`followUp.kind = none`; they used **2,586,614 recorded tokens**.

Examples include alert 4996 at 105.58 ms, recovery at 93.39 ms, alert 4998 at
134.36 ms and recovery at 96.59 ms, followed by alert 4999 at 106.17 ms and
recovery at 93.46 ms. The threshold is 100 ms. The reports repeatedly recognize
the same query fingerprint and existing no-change decision, finding no new
trend or spike class that warrants intervention.

This follows the installed transition rule: `metric-review.ts` suppresses old
cutoffs or automatic requests without an alert, but a new breach/recovery
cutoff can enter semantic assessment. The model then decides that the existing
disposition still covers the observation. This is a policy/value mismatch;
not every reported transition is an identical event-delivery bug.

**Owner and correction:** Alex's metric review policy, with the metric owner
defining meaningful reconsideration. Retain changed samples and transitions,
reuse the accepted disposition and its explicit revisit conditions, and spend
another assessment when those conditions change or an intentional review is
due. Do not raise thresholds merely to hide cost or suppress a new failure.
The existing allowance bounds rate but does not ensure valuable selection.

## Finding 3: Reddit wakes obey an access restriction but do no research

Four scheduled Reddit attempts, at October 16 12:09, 16:10 and 20:05 and
October 17 08:10 UTC, repeated the same review-only conclusion. They did not
scan Reddit, change the library or obtain a new decision. They consumed
**380,382 recorded tokens** in total, including cached input.

An explicitly requested recheck at October 16 20:13 UTC did useful work: the
public Atom feed returned HTTP 200 and 22 entries, and a source-limited finding
was published in `4f9964e07d`. The next scheduled attempt still required proof
of ordinary-permalink recovery and therefore did not use that successful lane.

The installed Scout App preserves the four-hour schedule and ordinary-permalink
access restriction. Its acceptance text also says that reaffirming the same
block is not research progress and asks for useful recovery or an exact owner
decision. The current Task has no Conditions or input waits. Its bounded
October 17 transcript shows five guidance/feedback reads, one Task read and a
finish call, without a new repair or owner request.

**Owner and correction:** Scout's research/access contract. Have the owner
resolve whether the demonstrated feed can serve the research assignment, or
retain the exact missing decision and observe it cheaply. Respect the standing
restriction while resolving that question. Repeated model confirmation of the
restriction does not advance the accepted assignment.

## Finding 4: an exact duplicate PR observation still reached a model

May Task `goal/appdep_c7098340ee8c5de1b6bc9709` ran 12 executions across real
PR #380 work, review feedback, human direction and an adoption trial. Most
cannot be dismissed as repetition merely because the Task ID stayed the same.

At 07:15 UTC, event `6677854` repeated PR fingerprint
`c386412c5de8301f1a2a3b01e55340c7d8fe151a5e8ad49d27ca22200e77e548`.
Execution `s_1792221321268_e10bb71a-6e9f-4bcd-b7c5-ef7b34145b6c` reread the
Task and GitHub, then explicitly concluded that the fingerprint was unchanged.
It used **65,583 recorded tokens**. Another 08:18 confirmation of facts already
accepted used 64,330 tokens. These are small beside the evaluation repetition,
but demonstrate that observation handling still permits avoidable judgment.

**Owner and correction:** inspect the shared event admission/Condition wake
boundary together with May's PR observer. The duplicate execution is proven;
the precise defect that allowed this wake is not yet isolated. Retain the
observation and suppress redundant reconsideration without losing genuinely
new review, merge or human input. #381's session recovery does not address
this selection problem.

## Useful work and design behavior that should be preserved

| App/path | Observed outcome | Limit |
| --- | --- | --- |
| Scout GitHub, HN and arXiv | 20 knowledge-library publication commits in the window, including new notes and updates. Read-back of the Memoria finding shows pinned source links, concrete storage/recovery distinctions and explicit limits. | Publication count is not a count of independent discoveries or proof every claim is correct; the sampled work is static research, not executed product validation. |
| Scout XHS | Four completed exploration workflows: two evidence-backed no-change results, one WorkRover finding and one RSIAgent update. | A fifth workflow blocked on extraction and was followed by successful work. The reports identify their secondary-source limits. |
| Alex and May engineering | SQL diagnostic enrichment `7c4ac4b21e` changed actual instrumentation/tests, records Bob's review and activation, and its adapter hash still matches the installed release. | Better diagnostics do not establish that latency itself recovered. |
| May continuation | The #380 adoption trial published once on the preserved Task branch and a new normal attempt reused that workspace successfully. | Human corrections and a repaired test fixture contributed; this was not fully autonomous end-to-end delivery. |
| Evaluator's broad audit | Its latest six-hour audit correctly treated zero work during runtime silence as missing coverage and reused existing ownership. | Its last audit cut was at restart, so it did not yet assess the post-restart repetition described here. |
| Quiet code and waiting | The selector ran 171 workflows without a matching selector model invocation. Existing human/dependency waits mostly stayed quiet. | A workflow count or old `attention` row is not by itself token waste or current failure. |

The latest 100 App inputs at the bounded read were done. Three older inputs
that initially looked stuck had exact retained admission links and explicit
source Task waits. Two recorded lock retries also have `recoveredAt`; the
remaining old notification does not prove lost work. Human presentation/reply
delivery was not tested in this review.

The filesystem had only **2.2 GiB available** and displayed **100%** usage at
collection. That is a concrete reliability concern alongside useful current
execution. No cleanup or failure injection was performed during this review.

## Recommended next change

Apply one App rule: **reconsider an owned decision when relevant evidence,
authority, actionable input or an intentionally chosen review boundary changes;
retain other observations without commissioning the same judgment again.**
An agent can still choose useful repair, research or another authorized method.
If no useful action remains, retain the exact missing fact/decision and its
return path. A fresh timestamp, unrelated producer result or new alert ID
alone does not establish a new decision.

Start with evaluation evidence identity and disposition reuse, then apply the
same rule to Scout's blocked-source continuation. Validate the exact duplicate
PR wake at its shared boundary. Keep a contrasting test for a changed human
answer, required artifact or dependency result so quiet handling cannot strand
real work. Measure model executions and verified progress together. These are
mostly App improvements; #381 remains complementary Host recovery work.

## Follow-up: existing fixes and remaining work

Before implementation, source and the loaded App release were compared. The
following fixes already exist; the findings above do not undo them:

| Existing change | What remains |
| --- | --- |
| `28251c9eec` and `0fb09a189b`: omit truncated linked-payload size from identity and test reuse | Finding 1 concerns readable producer content changing, not omitted byte counts. |
| `39a81a2afd`: review metric transitions, not ordinary sample changes | Finding 2 concerns actual repeated breach/recovery crossings. A historical no-change disposition does not by itself provide an executable rule covering every new episode. |
| `2a1871c3fa`: meaningful progress after scheduled wakes | Finding 3 persists despite that guidance. The ordinary-permalink restriction and demonstrated Atom-feed success need an owner strategy/access-contract decision, not another copy of the prompt. |
| Host #371: observer delivery intent | Finding 4 needs tracing through the exact Condition/admission route before attributing it to another Host defect. |

Source and active-release bytes matched for the pinned/public evidence readers,
metric review, Task selector and Scout App definition. The active App release
remained `697cc6c655c8c9e2cc02c0a0194abe220e6aae73-definitions-v5` during this
follow-up. Thus Finding 1 was not an unactivated version of the earlier fix.

The implemented change addresses Finding 1 at the shared evidence reader:
**a retained emission receipt is provenance, not a dependency on its producer's
future work**. The reader recognizes the Host receipt envelope across Apps;
it retains the receipt/content, follows other evidence and still follows that
same producer if an independent dependency or helper reference requires it.
Missing or mismatched receipt identity keeps the ordinary conservative linked
read. This extends the existing creator-provenance rule without a new lifecycle,
cache or Task-name exception. See the
[owning evidence contract](../../evaluation/task-outcome-evaluation.md#mechanical-versus-semantic-work).

Validation: the regression failed before the change. Afterward, 131 focused
tests passed with 888 assertions, including connected selector/report reuse,
zero extra model calls for producer-only changes with fresh allowance, changed
human-helper evidence, an explicit dependency on the same producer, pinned
artifact references, malformed envelopes and retained legacy receipt formats.
`bun run check:may-design` passed with the existing unclassified `reports`
directory warning. The additional paired-Host gate
`check:canonical-apps:final-runtime` failed on 15 type errors outside the change;
all 15 also reproduced on untouched `main` at `d6b38eb730`. Main additionally
reported three missing manifests in local legacy App directories. No new
diagnostic came from this change. Both gate logs are retained in the archive;
the broad compatibility gate is not claimed as passing.

An offline replay of the two recorded Finding 1 snapshots changes differing
baseline hashes (`267ed988…` and `604b9a77…`) into the same hash (`9474700d…`).
Both real May dependencies remain; the unrelated Scout producer read disappears.
The replay uses recorded Task/link views and an empty accepted-history page in
both cases, so these are reconstructed hashes rather than the original report
hashes. Its script/output are `replay-emission-provenance.ts` and
`replay-emission-provenance.json` in the external evidence archive below.

At implementation, this change was source-verified and awaited App activation.
The activation below completes that deployment step. It needs no Host patch.
It may cause one baseline reassessment as affected evidence identities change;
saved reports are not rewritten. No runtime Task was triggered, deployment
changed, or live savings measured. Metric reconsideration, Reddit strategy and
duplicate PR admission remain separate unresolved work, not claimed fixes.

## Activation and live readback

On October 17 at **10:42:52.698 UTC / 18:42:52.698 China time**, reload request
`6679301` completed as event `6679303`, `runtime.reload.finished`, with `ok: true`
and source commit `1472efcbc34200aa087fff172fafdd15faf56fae`.
The active release manifest names that commit. The canonical and loaded
`pinned-task-evidence.ts` both hash to
`174748e395d6a97c01bbcac0e719563c00c653564c49a53b64b5d919d87ce2d2`.
The reader is the only executable App change since the previous release;
already-merged documentation accompanied it. No Host binary upgrade or container
restart was performed. Existing attempts retain their selected definitions.

Replay against the **loaded release module** produces the same corrected hash
for both historical snapshots, retaining both real May dependencies. A fresh
public read of the live Alex subject also follows those two dependencies and
does not fetch `scout-knowledge-lib/explore-github` through emission provenance.
Its current hash is `c7ccd01224c5e745b79020a610360ac2350ec3a318437749a7ba27b73c848086`;
this live snapshot is distinct from the reconstructed historical replay.

The first 4.33 minutes after activation contained zero newly started model
invocations. All three Apps remained available, with zero attention Tasks;
Alex and May retained their six and nine waiting Tasks. This is a short health
readback, not a measured token reduction or evidence of a naturally occurring
producer-change opportunity. No extra model review was commissioned for the
trial. A new baseline review can still occur under the normal allowance.

Activation receipts, exact source hashes, loaded-module replay, current Task
reads and the bounded usage read are retained under
`/home/hao/workspace-archive/may-emission-activation-20261017/`.
Observe ordinary review reuse and changed-dependency coverage over the next
24 hours from activation, separating baseline reviews from avoidable repeats.

The metric follow-up reread the accepted owner Tasks
`may/goal/appdep_04ee71d790343cff3107a3e0` and
`may/goal/appdep_8106e125148535483a34ec10`. Their `revisitWhen` fields are prose
about uncontended query latency, controlled equivalent index trials and
lock-owner/WAL diagnostics. The current metric observation does not establish
those facts. It reports a worst duration and bounded query examples; a repeated
query fingerprint or another crossing of 100 ms cannot prove that the owner's
decision still covers the situation. The next mechanism is scoped in the
existing [App reconsideration proposal](../../../../may.app/design/token-efficiency-proposal-20261002.md#c--reuse-an-owner-decision-with-explicit-scope).
The follow-up below implements that optional App contract. It is not a live fix
or an accepted scope for this query-cost decision.

## Optional owner-decision reuse implementation

The App change adds `reuseScope` to existing metric decisions and validates its
observable applicability/reconsideration predicates against fresh evidence at
composition. Automatic review checks the latest accepted owner decision, the
requested and fresh observations, and current source/linked Task obligations
before claiming semantic allowance. Matching scope settles as `decision-reused`;
changed/missing evidence, newer unscoped decisions, current work or due boundaries
leave bounded review eligible. Explicit reviews bypass scope, while staged
reports retain publication precedence. There is no Host lifecycle/schema change
or additional decision registry.

The [contract](../../evaluation/metric-pattern-review.md#reusing-an-accepted-owner-decision)
and [manual](../../2b-manual/metric-alerts.md) describe the exact optional shape
and its conservative coverage limits. Source checks cover both reviewers and
direct/selector entry, strict value identity, source/definition/responsibility
changes, missing/truncated scope, latest-decision supersession, current Task
boundaries, monotonic coverage and publication retry. A real Host fixture also
accepts the scoped fact, retains its provenance and reuses it after restart.

Validation: 48 focused tests pass, and `check:may-design` passes with the existing
unclassified `reports` directory warning. The real Host follow-through suite has
15 passing cases and one pre-existing retry timeout; that timeout also reproduces
on untouched `main` at `8ec26cb1bb`. The broader final-Runtime gate still reports
the previously documented 15 baseline type errors, with no new diagnostic from
this change. These failing gates are not claimed as passing. Logs are retained at
`/home/hao/workspace-archive/may-metric-decision-reuse-20261017/`.

At implementation completion this extension was not active and no owner-agent
review had been commissioned. The following rollout records subsequent
activation separately from an owner's adoption. No existing prose decision was
migrated and no production token saving is claimed.

## Owner-decision reuse activation

On October 17 at 11:27:04 UTC, normal App reload completion event `6679582`
confirmed source `03cfc3546f9a849f3f9c1333e19d2d2e47f1cab5`, including
implementation `a57c0068133ea9a646eddac93d376631e5b04a60`. Request event
`6679580` fenced the expected source commit. The current release manifest and
all six changed executable-file hashes match the reviewed source. All three
Apps remain available. This activation required no Host upgrade, restart,
direct database edit, or schedule/budget change.

The user-authorized scope request was admitted as event `6679592`, request
`app_738654a9-73e9-4b19-b560-decc0f6b0e54`, on existing May Task
`goal/appdep_04ee71d790343cff3107a3e0`. Its generation remains 1; no replacement
investigation was created. The request asked May to
choose a justified observable scope or name the exact missing measurement,
preserving the original investigation constraints. May owns that decision;
Alex owns any measurement improvement and Evaluator assesses work.

May completed it at 11:28:46 UTC in accepted attempt
`r_1_feaef4b5-0ef9-460c-a313-cfe04d15dfdc`, resource version 8. Both the
request and Task read back as `done`, with no pending inputs or Conditions.
The accepted result retained `no-change` without `reuseScope`. Sample `2227275`
was 155.94 ms across 17 queries with zero failures, but declared
`examplesTruncated=true` and `evidenceTruncated=true`; it could not establish
equivalent workload, absence of shared contention or a controlled index trial.
May rejected inventing a numeric proxy for those requirements.

The exact Task/time-window usage read records one owner invocation lasting
64.2 seconds, with 9 measured replies: 119,903 input tokens, 408,576 cache-read
tokens and 3,709 output tokens. These are recorded accounting categories, not
unique context or proof of billed cost. The one-time review resolved the scope
question; repeating it without the missing measurement would add no evidence.

May named the missing measurement: complete attempted-query cohort identity
and coverage with pass-level evidence distinguishing shared contention, or a
linked controlled equivalent before/after trial. No measurement-improvement
request was created. Alex should scope that improvement and return evidence
to this existing May Task. Collection evidence belongs to the Host; scope
judgment and reuse belong to the App. The Host's query-note truncation is an
intentional size bound; larger notes alone would not prove equivalence or
absence of contention.

Read-only checks importing the active release returned
`latest-decision-has-no-valid-scope` before and after acceptance. The second
check saw the new accepted attempt through the public metric projection,
alongside later sample `2227295` at 81.67 ms. Recovery of the scalar did not
manufacture scope. This proves the accepted decision is wired through the
eligibility check; live token savings for this metric remain unproved.

Checks against the loaded release passed: 5 eligibility cases (32 assertions)
and 6 selected workflow cases (38 assertions). Matching fixtures reuse across
episodes and selectors with zero model calls, publication or allowance spend;
changed values, revoked scope, due obligations and unavailable evidence keep
review eligible. Explicit review still assesses and staged reports still
finish publication. These are controlled fixtures, not live accepted reuse or
measured production savings. The earlier baseline gate failures remain as
documented above.

Rollout receipts, source hashes, live evidence and loaded-code test logs are
retained under
`/home/hao/workspace-archive/may-metric-reuse-activation-20261017/`.

## Evidence and review limits

Read-only collection and aggregates are retained at
`/home/hao/workspace-archive/may-runtime-review-20261017T1013/`, including
`usage.json`, `sessions.json`, `workflows.json`, `all-attempts.json`,
`task-resources.json`, `scout-commits.txt` and `summary.json`.
Scripts have bounded indexed reads and query deadlines; no database snapshot
or large temporary clone was created. Counts cover the fixed window; later
Task/definition readbacks are identified as current observations.

The two unchanged-wait reports are under
`.state/evaluation/reports/task-outcomes/evaluator-deepseek/alex/task-obligation-v1/`
with the Task ID and evidence-hash prefixes above. Metric report paths are
retained in the corresponding attempt facts. Targeted transcript extracts
cover the duplicate PR wake and latest scheduled Reddit attempt.

See the [branch publication trial](task-branch-publication-20261017.md) for
independently retained continuation evidence. Findings here distinguish
recorded accounting, inspected behavior, source-derived causes and unresolved
questions. They do not claim a complete audit of every task, universal
escalation recovery, actual billed cost or zero value from all review work.
