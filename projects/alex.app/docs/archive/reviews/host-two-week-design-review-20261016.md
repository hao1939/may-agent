# Two weeks of Host changes: design lessons — 2026-10-16

**Status:** Commit-history and selected implementation review. No new runtime
trial, deployment or live token measurement was performed for this extension.
**Supports:** [Host contract improvement proposal](../../proposals/host-contract-improvements-20261016.md).
Current rules belong to the [principles](../../1-principles/core-principles.md)
and [Host/App contract](../../2a-design/system-boundary.md).

## Scope and method

The window is October 2–16, 2026, through local Host main
`ff3449013a77a9a79ca0c877e0a7c090f5d51228` and Apps main
`3ca6dd6f72aba4a408b6afdd61442cc17662576c`. There are **89 reachable Host
commits** in that window: 61 `fix`, seven `perf`, six `feat`, 12 `chore`, two
`test` and one `refactor`. Companion Apps history contains 388 reachable commits,
including merges, documentation and Scout publications; that is not 388 defects.

Reviewed the Host subject inventory, then selected diffs, source contracts and
test changes for the recurring boundary families below. Screened Apps history
for policy, observation, context and recovery counterparts and inspected selected
changes. This is not a full diff audit of all 477 commits, an author-by-author
review, or proof that all recent fixes work in the installed container. Counts
describe reachable commits by committer date, including merged branch history.

Reproduce the inventory in each pinned checkout with:

```sh
git log --since='2026-10-02T00:00:00+08:00' \
  --until='2026-10-17T00:00:00+08:00' --format='%h %cI %s'
```

The earlier [source review and isolated probes](host-contract-review-20261016.md)
remain the evidence for currently reproduced gaps. Its 285-test and six-probe
counts were not rerun or increased by this history review.

## Recurring patterns and useful corrections

### 1. Recording a fact repeatedly turns into requesting work

Host [#293](https://github.com/hao1939/may-agent/pull/293) separated unchanged
Condition checks from agent review; [#301](https://github.com/hao1939/may-agent/pull/301)
separated samples from rule evaluation. [#334](https://github.com/hao1939/may-agent/pull/334)
made guard facts record-only; [#338](https://github.com/hao1939/may-agent/pull/338)
replaced routine no-attempt Events with bounded counters.
[#351](https://github.com/hao1939/may-agent/pull/351) separated progress from
caller attention; [#366](https://github.com/hao1939/may-agent/pull/366) carried
observation intent and exact identity across worker delivery.

The inspected #338 implementation keeps counters without Task writes, Events or
per-Task series. #366 leaves receipt acceptance with the parent that sees the
required consumers. These are reusable corrections. The remaining ordinary
observer gap shows that not every producer yet follows the convention.

There is a separate App recurrence: Apps `39a81a2afd` changed Evaluation's
periodic fallback from changed samples/timing to saved alert transitions.
Host observation support alone cannot keep an App's selector from requesting
unnecessary work. The contract must separate publication, required delivery,
execution eligibility and App judgment; each violation belongs to its owner.

### 2. Nearby evidence is mistaken for the authoritative fact

[#300](https://github.com/hao1939/may-agent/pull/300) tied alert transitions to
committed publication; [#302](https://github.com/hao1939/may-agent/pull/302)
reused saved report publication identity. [#336](https://github.com/hao1939/may-agent/pull/336)
retained App admission independently from other Event acceptance. Its recovery
scan fixes a cycle's upper bound so new traffic cannot indefinitely postpone
revisiting an older failed row.

[#364](https://github.com/hao1939/may-agent/pull/364) uses the Event journal to
decide whether a schedule slot was published; reload no longer replaces the
input for that slot. It deliberately adds no scheduling ledger.
[#367](https://github.com/hao1939/may-agent/pull/367) removes storage code that
inferred delivery acceptance from a terminal session payload.

The common lesson is to ask the fact's owner, retain identity, and recover the
unfinished boundary. The remaining process-birth cutoff in receipt expiry is
another instance of substituting a convenient hint for durable state. Repeated
consideration is acceptable; rewriting a saved instruction or hiding a required
consumer's failure is not an equivalent tradeoff.

### 3. Useful progress gets coupled to completion or perfect context

[#303](https://github.com/hao1939/may-agent/pull/303) made earlier unanswered
input visible as current work, including when no new Events arrive.
[#305](https://github.com/hao1939/may-agent/pull/305) removed blanket rejection
of results/effects merely because other input was pending.
[#313](https://github.com/hao1939/may-agent/pull/313) allowed explicit coverage
of outstanding input received during execution.

[#309](https://github.com/hao1939/may-agent/pull/309),
[#337](https://github.com/hao1939/may-agent/pull/337) and
[#354](https://github.com/hao1939/may-agent/pull/354) retained results or evidence
through dirty workspaces, routine checks, App removal and incomplete recovery.
The refined proposal must preserve these independent facts. An accepted
contribution, attempt completion, request fulfillment and cleanup do not have
one universal success bit. Current recovery confirmation also needs to
distinguish required ownership evidence from optional historical artifacts.

### 4. Recovery strategy briefly becomes Host policy

[#325](https://github.com/hao1939/may-agent/pull/325) introduced responsible-agent
recovery for failed procedures. [#344](https://github.com/hao1939/may-agent/pull/344)
subsequently removed result-driven executor switching and let workflows compose
ordinary agent calls. The declared procedure remains the procedure on the next
attempt. Apps `e18858a75d` supplied the companion contract/consumer changes.

This is a design refinement, not evidence that all failover is wrong. A workflow
can choose a recovery method; Host must not silently adopt that temporary method
as the Task's future procedure. [#326](https://github.com/hao1939/may-agent/pull/326)
likewise removed installation/domain policy from Host code. Routine App migration,
renaming and workflow evolution should not require core edits.

App-only changes reinforce the boundary: `5c2c42cf0a` narrowed automatic selection
to stop report-disposition recursion; `22e21e7473` made reviewers decide whether
their report requested Alex's action. Host should provide reliable reports and
requests, not choose which Evaluation result deserves another review.

### 5. The agent cannot correct a problem after its execution has ended

[#284](https://github.com/hao1939/may-agent/pull/284) repaired native execution
and correction reachability. [#297](https://github.com/hao1939/may-agent/pull/297)
and [#335](https://github.com/hao1939/may-agent/pull/335) moved knowable validation
feedback before finish. #335 previews explicit input coverage using the same
validator as settlement; the commit still revalidates against current state.

[#308](https://github.com/hao1939/may-agent/pull/308) leaves time inside the
existing allowance for partial-result submission. [#358](https://github.com/hao1939/may-agent/pull/358)
lets a live caller correct its owned running helper, with ancestry/attempt
checks. Queued correction is not guaranteed consideration, and durable
requirement changes still belong to Task input.

The useful principle is an executable feedback loop: current context, usable
capability, corrective response and a chance to finish. More retry policy is not
the first remedy for a broken loop. This was underrepresented in the initial
five-fix proposal and is now explicit in C1/C5 and the contrasting-path trials.

### 6. A bounded output hides unbounded work underneath

The sequence includes indexed lookups
([#278](https://github.com/hao1939/may-agent/pull/278),
[#280](https://github.com/hao1939/may-agent/pull/280),
[#299](https://github.com/hao1939/may-agent/pull/299)), shorter writer-lock work
([#320](https://github.com/hao1939/may-agent/pull/320),
[#328](https://github.com/hao1939/may-agent/pull/328),
[#331](https://github.com/hao1939/may-agent/pull/331)), and bounded history selection
([#329](https://github.com/hao1939/may-agent/pull/329),
[#330](https://github.com/hao1939/may-agent/pull/330),
[#340](https://github.com/hao1939/may-agent/pull/340)).

The inspected #328 moves preparation outside its own write transaction and makes
queries match an existing partial index. #330 ranks IDs before loading JSON.
[#365](https://github.com/hao1939/may-agent/pull/365) indexes actual recent-page
ordering. [#352](https://github.com/hao1939/may-agent/pull/352) adds bounded plan
evidence instead of guessing at query cost. Apps `b0f76ad100` reuses metric cohorts
at the query owner. These are good practice to retain.

The remaining synchronous retry helper and metric query execution show that
containing one cost does not bound the whole operation. Fewer returned rows,
read-only storage and a short inner timeout each establish a limited property.
Measure selection, sorting, lock time, sleeps and shared-process impact separately.

### 7. Retry, shutdown and upgrade are part of the contract

[#281](https://github.com/hao1939/may-agent/pull/281),
[#289](https://github.com/hao1939/may-agent/pull/289) and #308 strengthen helper
lifetime, common deadlines and finishing. Fixture cleanup in
[#341](https://github.com/hao1939/may-agent/pull/341) and
[#343](https://github.com/hao1939/may-agent/pull/343) is also valuable: the test
process should not leave workers behind and distort later observations.

[#359](https://github.com/hao1939/may-agent/pull/359) bounds unroutable recovery;
[#360](https://github.com/hao1939/may-agent/pull/360) gives Task attempts bounded
defaults with retained retry-series identity. #354/#363 address evidence and
claim recovery. The implementations differ because the operation costs and
authorities differ. One universal retry engine would hide those distinctions.

Mechanical retries need a budget, a durable owner where work is accepted, and
visible exhaustion. App strategy can choose another authorized approach.
Reload/cold-cache recovery must not reset exhausted work into a perpetual loop,
discard independent Conditions or treat missing evidence as proof of success.

## Coverage and priority

| Lesson or weakness | Initial proposal | Refined proposal |
| --- | --- | --- |
| Passive facts, live/recovered observation and truthful receipts | Directly covered by observer and expiry fixes | Generalized as C2/C3; worker and required-consumer contrasts made explicit |
| Blocking waits and expensive SQL | Directly covered | C5 includes total cost, history selection, fairness and finishing; SQL contention remains first runtime fix |
| Ambiguous recovery confirmation | Directly covered, with important safety qualifications | C4 preserves the declared procedure and tests optional artifacts versus ownership across callers/backends |
| Usable context and correctable result submission | Mentioned only indirectly | Added philosophy and C1/C5; preserve #303/#308/#335 through boundary trials, no new context framework |
| App policy leaking into Host / recursive App review | Broad extensibility language only | Explicit C4/C6 and App-owned follow-up; no Host repair for an App's selection decision |
| Fair recovery under continuous input | Bounded scans mentioned | Added high-water-mark/revisit contrast; retain #336 rather than invent another scheduler |
| Alternate paths and evidence status drift | General compatibility check | Explicit live/worker/restart/upgrade/removal contrasts and contract/source/deployment distinction |
| Backup restoration and temporary model fallback | Narrow follow-ups | Unchanged: no new loss evidence or need for a general model router; restore-safety failure would raise priority |

The strongest recurring weakness is incomplete adoption of shared contracts,
combined with convenient but unjustified semantic assumptions at boundaries.
This does not establish that every later fix is a regression of an earlier one:
some cover a different producer, caller, backend or lifecycle stage.

Positive patterns are equally clear: removing inference, reusing the journal,
small indexed reads, precise validation, retaining partial work and moving
strategy into App composition. Favor those corrections over new infrastructure
frameworks. Do not reopen completed fixes solely because they appear in a family.

Documentation remains a practical weakness: current principle/Task pages still
teach superseded retry defaults, and some current-design status paragraphs refer
to earlier candidates despite later source changes. The proposal calls for
reconciling the owning rules and available deployment receipts alongside each
change. Merging prose alone does not establish installed behavior or useful
agent outcomes.
