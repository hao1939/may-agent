# Routine review, Request meaning and evidence-read cost

The October 1 trace review found several connections amplifying routine work.
The changes repair existing contracts: no additional notification queue, intent
classifier, review lifecycle, or authority store is introduced.

## Changes and ownership

| Concern | Cause | Correction |
| --- | --- | --- |
| Repetitive replies | May accepted an automated inspection as a new human Request; closing it correctly required a reply. | The Host tool/schema and May guidance consistently define a Request as an accepted conversational promise to the human. Routine handling stays in turn/Task evidence. Existing human promises retain their closure contract. |
| Oversized context | Historical command links automatically expanded full Task observations outside the Conversation history budget. | Show current inputs and assigned Request scopes, compact explicit focus, then exact Task links. Full requirements, independent waits and evidence remain available through ordinary exact reads. |
| Review already due | Next review used an old evidence cutoff plus the assessment allowance. | Successful publication starts the next routine interval. DeepSeek keeps five-minute capacity for different work and a one-hour interval for reconsidering the same metric; the regular reviewer keeps one day. Explicit reviews remain available. |
| Evidence read latency | The accepted-decision view expanded facts from all attempts on each exact metric read; the watcher also fetched an App catalog it did not use. | The Host indexes candidate attempts before applying unchanged fact validation. May's watcher reads retained observations directly; Evaluation adds App responsibility when reviewing. Caller cancellation reaches HTTP/socket reads. |

Status: source validated and committed; these refinements are not deployed.

Host [PR #277](https://github.com/hao1939/may-agent/pull/277) owns the Conversation
presentation/contract changes (`1c2f8366`). Host
[PR #278](https://github.com/hao1939/may-agent/pull/278) owns the SQLite index and
view upgrade (`18785a27`). The companion
App change owns May's judgment guidance, Evaluation cadence and observation reads.
The common design records the Request and context hierarchy contracts in
`may-agent.app/docs`; Evaluation policy stays in its own design.

## Checks and trials

Both final Host candidates passed full local CI: 3,375 tests for Conversation
and 3,371 for metric reads, with zero failures. Evaluation and May source
typechecks, owning tests (246 and 149 passes), bundles and common-design checks
passed.
May's suite has one existing skipped integration test; the Host suites have three
deployment-only skips. The additional observer test also passed a strict test
file typecheck.

The Conversation regression supplies a large Task input. The initial assignment
contains its identity and compact summary or reference, while a reread confirms
the complete input is unchanged. Existing tests retain human-response, Request
closure, restart and quiet-delegation checks. For two captured contexts, replacing
only automatically expanded historical Task bodies reduced compact context from
about 135/139 KB to 24/25 KB (about 82%). This measures payload, not model accuracy.

A native model trial used May's actual definition builder, shared instructions,
skill catalog, full tool schemas, production Conversation resolver, finish
validation and isolated transactional settlement. The inputs were two captured
noisy reviews. Read results were replayed from their original sessions; unknown
reads returned explicit unavailable results, and no external action was executed.

- The initial baseline recreated a Request, had quiet fulfillment rejected, and
  added a reply. A second baseline recreated the same Request and, after the same
  rejection, left it open instead. Both show the incorrect obligation; they do
  not establish that a reply is inevitable on every run.
- Candidate metric and Task reviews both settled with retained summaries/facts,
  zero new Requests and no response.
- The genuine human-request control answered the comparison and closed the
  existing Request. It passed in both trial rounds.

The initial fixture omitted historical Topics and could not settle three
results. Those failures are retained. The corrected fixture passed both
candidate reviews; for the remaining baseline Topic, the exact canonical Topic
was restored in the isolated database and the unchanged model result settled.
No model decision was rewritten to make a trial pass. Several optional reads
had no exact replay result, so these trials do not certify live workflow success,
autonomous diagnosis, or long-term message quality.

The evidence-query comparison used a copied attempt table, with no live schema
mutation. Old/new views returned the same 1,091 rows across 73,079 attempts.
The reduced-table benchmark took 1.70 seconds versus 0.10 seconds. With the
full Host indexes restored on a disposable copy, an exact metric read took
about 3.0 seconds versus 0.13 seconds and used the new index. Unfiltered exports
can choose a different plan; this is an exact-read optimization, not a promise
that every query over the view becomes faster. The production schema upgrade preserves validation,
source identities and accepted facts. It replaces an old view once and leaves
the current view unchanged on later openings.

## Remaining root-cause limits

The slow projection is measured, and removing the watcher's unrelated catalog
read removes one failure dependency. Broader daemon responsiveness is not yet
explained completely. An inexpensive catalog query took about 24 ms alone,
while two socket reads timed out at six seconds. Retained logs also show SQLite
write contention and delayed event subscribers. The minute heartbeat sometimes
arrived about 78–82 seconds apart. These observations point to shared-process
blocking/contention, but do not identify one sufficient cause.

All active source-query metrics were checked read-only; the slowest took about
0.22 seconds in that sample. That does not explain the multi-second stalls.
Attaching a system-call tracer was denied by the environment. Do not increase
timeouts or claim all timeout causes fixed based on the index benchmark.

After reviewed rollout, compare watcher completion/failure and exact read latency
with the retained baseline. Review the first Request/finish decision, not only
the final message. Check that genuine human outcomes and human-action Conditions
still arrive, and distinguish different useful reports from duplicate delivery.
Use the existing observer health, Task evidence, event journal and Telegram
receipts; no new monitor or automatic task cleanup is needed for this trial.

Private replay prompts, traces, SQL plans, timing results and reproduction scripts
are retained under `.state/review-pilots/telegram-noise-20261001/latest-review/`.
They are not public Host PR fixtures. Nothing in this source trial changes live
Requests, Conditions, metric definitions, approvals or Task records.
