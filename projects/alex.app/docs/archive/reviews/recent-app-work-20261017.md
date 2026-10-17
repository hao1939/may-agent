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
