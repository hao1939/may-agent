# Systemic review of retired-App state cleanup

PR: [Host #410](https://github.com/hao1939/may-agent/pull/410)  
Reviewed correction: `d4f00453b6640c06cf48a393edbfca01e77051e9`

Merged on 2026-11-09 at `06e7870b722a22037c64c2eb8a03f799457e5c7c`.
The original installation candidate remains blocked by legacy provenance;
merging the source does not apply or deploy it.

The repeated comments exposed a missing preservation invariant, not isolated
syntax errors. App-definition migration and filesystem retirement did not
establish that historical Task state satisfies the newer per-attempt acceptance
contract. Earlier retirement checks and rehearsals overstated that readiness.
Production state has not been changed by this review.

## Root cause and review-process failure

The operation conflated four facts: a caller's exact requirement and answer
scope; a Task's current desired generation; a mutable progress/diagnostic
projection; and durable accepted execution evidence. A pending or waiting Task
can still hold an older answer. A missing reference does not prove there is no
outcome. Controller acknowledgement can rewind on retry. An incomplete report
has an accepted summary and a different diagnostic summary, both legitimate.

The earlier review patched each reported example and tested nearby cases. It
did not first inventory all answer carriers or assert conservation of every
field cancellation overwrites. The private audit also repeated the current
phase/reference heuristic, so its counts inherited the same blind spots.
Passing CI proved those examples, not completeness of the retirement model.

For further review, start with the fields the operation overwrites, identify
every durable carrier of those values, and trace the canonical writers through
completion, wait, failure, revision, retry, cancellation and reopen. Test both
loss refusal and legitimate withdrawal, including replay after history changes.
Use the same preservation proof for the private census and the operation, then
keep source correctness and installation readiness as separate conclusions.

## Findings and corrections

| Finding | Effect | Correction |
| --- | --- | --- |
| Phase/reference used as a gate | Pending, waiting and attention projections lost outcomes when the observed reference was absent or dangling. | Every present summary, response or result requires a retained source; missing provenance refuses the transaction. |
| Diagnostic text treated as the accepted summary | Canonical incomplete reports were rejected despite retained evidence. | Summary may match accepted text or the exact same attempt's retained summary; response/result checks remain strict. No prefix whitelist. |
| Controller generation treated as payload generation | Explicit retry made retained accepted evidence appear mismatched. | The observed attempt owns its payload generation and exact identity; controller acknowledgement is independent. |
| Completion inventory omitted terminal history | An answered caller could be stopped unfulfilled when its only completion authority was a closed record, including one archived by reopen before a later cancellation. | Reuse the admission-specific terminal-history reader; distinguish completed from cancelled authority. |
| Preservation skipped on replay | A prior cancellation hid deleted or changed accepted history. Terminal response/facts changes were also overlooked. | Apply and replay run the same proof against original reviewed preimages, and replay checks terminal response/facts. |
| Attempt key and embedded identity were not both checked | Conflicting retained identity could pass. | Verify exact attempt ID, Task ID, completed acceptance and valid attempt generation. |

`assertRetainedRetirementOutcome` is a read-only Host function used by both the
operation and the private inventory. It makes no acceptance record, chooses no
latest attempt or alias, and does not claim that preserved progress fulfills a
caller. All checks precede mutation; dry-run and refusal retain atomic rollback.
The generic Host evidence contract is documented in its operations guide.

## Validation and review scope

The audit followed canonical completion, waiting, incomplete reporting, retry,
cancellation and reopen transitions; legacy completion import/cutover; durable
admissions and exact result scope; Task/attempt/receipt/control/terminal storage;
complete censuses, raw preimages, digest-bound replay and CLI transactions.

The expanded baseline suite reproduced 17 failures. Separate probes reproduced
two further completion-authority failures: current closed-only history and an
older completion archived by reopen followed by a newer cancellation. There are
29 additional regression cases, with 91 focused retirement tests passing on the
corrected source. They include successful incomplete-report withdrawal under
backoff, exhaustion and explicit retry, alongside refusal controls and whole-DB
rollback/history-preservation assertions. Current full validation is retained in
`admitted-caller-withdrawal-preparation-receipt.json` under `systemicReviewCorrection`;
previous revisions' results remain historical.

Full local CI on this correction passed type, SDK, App-boundary and lint checks,
then finished with 4,022 tests passed, three skipped and one failure. The
unchanged Conversation waiting-report test observed Request closure before its
final presentation reply settled; both parameter cases passed in one standalone
diagnostic run. The full-suite failure remains recorded, without automatic
retries. Hosted Container validation passed; hosted Quality was cancelled on
2026-11-08 at 20:05:27 UTC and is not recorded as a pass.

## Saved state readiness

The exact Host preservation function now identifies **59 of 66** planned Task
projections as requiring provenance review. This supersedes the earlier count of
nine, which skipped outcomes outside its phase/reference gate.

| Evidence gap | Count |
| --- | ---: |
| Missing observed-attempt reference | 52 |
| Observed attempt retained without accepted-result data | 7 |
| Summary only | 40 |
| Summary plus result | 19 |

The blocked phases are waiting 32, attention 24, pending one and converged two.
These are evidence gaps, not proof that 59 business tasks must run again or that
59 outcomes were fulfilled. Some summaries may be controller diagnostics; the
operation must not guess from their text. The snapshot contains no selected
replacement answers or alias decisions.

`systemic-review-legacy-provenance-inventory.json` lists the 59 exact preimage
hashes, references and retained-history counts without assigning new acceptance
or fulfillment. `state-admitted-withdrawal-systemic-review-rehearsal-receipt.json`
records actual dry-run and in-memory apply refusal, with every loaded table
unchanged. Its census remains 66 nonterminal Tasks, four unfinished inputs and
41 Conditions. These are saved query-only reduced-snapshot findings, not a fresh
live census or a full offline backup.

## Required next movement

Keep the candidate blocked. Review original provenance and preserve legacy
observations as such; restore accepted identity only where original evidence
supports it. Do not copy all summaries into new accepted answers, choose a
historical alias, erase an ambiguous result, or rerun business work merely to
satisfy this migration. Missing identity may require a separately reviewed
legacy-observation cutover; existing acceptance import must not be forced past
its own evidence checks.

Only after supported preservation/cutover, reviewed Host support and merge,
stopped workers, a verified full offline backup and fresh exact preimages can a
new complete retirement plan be applied. Independent current May/Alex
obligations remain independent. See [cleanup history](retirement-cleanup-2026-11-09.md).

## Explicit observation preservation follow-up

[Host PR #444](https://github.com/hao1939/may-agent/pull/444), source
`956d3fcd39`, adds a separate reviewed `legacyObservation` preservation decision.
It copies the exact original Task and trigger bytes into the cancellation control
receipt as an unverified legacy observation, atomically with withdrawal. This
creates no acceptance record or caller answer and selects no alias. Existing
caller-answer guards still apply. Default plans retain their provenance refusal.
Missing or altered archival bytes refuse replay, and failed/corrupted archival
writes roll back cancellation and caller withdrawal.

All 117 focused retirement regressions and type, SDK, App-boundary and lint
checks pass. Full local and hosted validation are in progress; the PR is draft.
An isolated rehearsal of the saved reduced snapshot reaches zero nonterminal
Tasks and zero unfinished inputs, preserving 59 exact legacy observations and
all loaded attempts, admissions, completion receipts, prior terminal/control
decisions and independent App state. Dry-run restores every loaded table and
replay changes nothing. The original candidate still refuses.

A query-only live comparison on 2026-11-09 at 04:17 UTC finds the same 66 Tasks,
four unfinished inputs and 41 Conditions, with all reviewed Task/trigger and
input preimages unchanged. This is a read-only comparison, not quiescence proof
or a full offline backup. Private evidence is retained in
`state-legacy-observation-rehearsal-receipt.json` and
`state-legacy-observation-live-preimage-check.json`; the separate candidate is
`retirement-plan.legacy-observation.candidate.json`. It is not ready for
production application before Host review/merge, stopped-state verification
and the full backup procedure. Production state remains unchanged by this work.
