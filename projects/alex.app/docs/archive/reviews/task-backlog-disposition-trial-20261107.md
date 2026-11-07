# Existing Task backlog disposition trial — 2026-11-07

**Supports:** [Carry work through change and interruption](../../2a-design/system-model.md#carry-work-through-change-and-interruption).
**Choice basis:** [Simple first](../../1-principles/core-principles.md#simple-first): bounded reads and existing guarded controls, without another Task lifecycle or review queue.

**Source status:** The App workflow and guidance accompany this record. Host
[PR #392](https://github.com/hao1939/may-agent/pull/392) at
`1489722196d660a3a113818db7487e656fc0cc51` supplies the matching lifecycle and
creator closure capability. Both GitHub checks passed on that revision.
**Operational status:** Public read-only traversal and isolated replay completed.
No live Task was closed, cancelled, reactivated or assigned a new review job.
Source integration does not activate the new workflow in existing sessions.

## The practical refinement

The [lifecycle contract](../../2a-design/task-resource-engine.md#state-and-continuing-responsibility)
needs a practical path for a large retained population. The Alex workflow
`task-disposition-review` reads at most ten existing Tasks per invocation through
the established public evidence adapter. It makes no model call or mutation.
It returns bounded previews, current accepted-result and version references,
continuation and explicit retry identities. Missing or truncated obligations,
projection disagreement and failed reads remain visible evidence gaps.

The owner saves pages and works through the same review, rather than making a
Task for every record or rescanning from the beginning. `owner-review` means
there is no recorded runnable obligation and a semantic decision is needed. It
does not prove finite scope, fulfillment, absence of an input route or permission
to close. Full originals, accepted scope, caller promises and current fences must
be read before an effect. Old `done`/`up-to-date` output remains supported.

An intake that verified and dispositioned a report can end without certifying
the report's subject as fulfilled. Likewise a published snapshot assessment can
end while the assessed work remains waiting. A genuine promise to follow through
still needs its owner and return route. Historical missing creator provenance is
not repaired by guessing from parent links; use trusted App/operator authority.

## Actual population traversal

On November 7 at 15:23:33–15:23:41 UTC, the helper read all **544** Alex records:

| Review route | Records | Meaning |
| --- | ---: | --- |
| Owner review | 531 | Idle assignments need a scoped decision; none is automatically approved for closure. |
| Standing work | 2 | The declared runtime audit and research-adoption schedules remain. |
| Retain work | 6 | Existing waiting obligations remain with their current owner. |
| Ended history | 5 | Existing cancellation evidence remains terminal. |

The traversal used 55 list pages and 539 pairs of exact SDK/human reads. No
identities were repeated or omitted from the 544-record source population, and
no read failed. The largest compact JSON page was 17,077 bytes, below the 30,000
byte bound. This is coverage of live navigation and current mechanical facts,
not an atomic database snapshot or substantive re-audit of all 531 assignments.
The previously discussed 528 historical records are part of that owner-review
population; three other idle records were already in the detailed review set.

## Isolated closure trial

A read-only export retained all 544 current resources, their 542 referenced
attempts, six Conditions, five terminal decisions and scheduler hints. Its
SHA-256 was
`85e73535e61b168d68c86ee50b4a7d324f09b06dd77fd40e8f3ffe3ecb1a8c66`.
The matching Host candidate imported this into a separate SQLite database.

Eight examples were reviewed: five report intakes and three independent snapshot
assessments. Their immutable publication bytes verified through the existing
publication reader. Original assignments and accepted results established their
bounded report scope; linked subject Tasks were read explicitly. Each recorded
disposition ended that report assignment while preserving independent subject,
cleanup and caller obligations. These are eight scoped owner judgments, not a
new verification of every historical technical claim or of eventual subject
fulfillment.

The existing guarded close succeeded for all eight in the isolated copy:
533 idle / six waiting / five cancelled became **525 idle / eight closed / six
waiting / five cancelled**. All 536 other resources were unchanged, including
the standing work and genuine waits. Accepted attempts, facts and result bodies
were preserved. Replaying each exact close was idempotent. Separate probes
rejected a stale resource version and an assignment with newly queued input.

The replay imports Task authority and Conditions, not the complete installation's
inbox and cross-App delivery graph. Linked May subjects were read through the
live read-only interface. This verifies Task closure mechanics and result
retention; it is not an end-to-end delivery or deployment experiment.

Local evidence is retained under the installation's
`.state/task-disposition-trial-20261107/`: per-page JSON, inventory, source export,
sample identities, publication checks, explicit closure reasons and replay
results. These private operational records are not Host fixtures or PR payloads.
The trial neither deployed the Host nor changed the live backlog.

## How to handle the remaining records

Continue one bounded owner review with saved pages. Review report-intake and
independent-assessment scopes first, using their exact original requests and
publication evidence. Keep unresolved follow-through visible; a topic match,
empty queue or converged summary does not discharge it. Preserve the two standing
assignments and six waits unless their own evidence supports a changed decision.
For each reviewed ending, retain the disposition reason and current guarded
control receipt. Retry stale or missing evidence by identity. Do not create a
timer, a new Task per record, a second status registry or a bulk success label.

## Source validation

- 54 focused tests passed across the new batch workflow, public evidence adapter
  and immutable report reader. Nine cover the new workflow, including 528-record
  traversal, legacy status compatibility, mixed responsibilities, failed reads,
  stale evidence, cancellation, duplicate identities and bounded output.
- The new workflow, its tests and their dependency closure passed a strict
  TypeScript check against the matching Host SDK. This focused check is not a
  claim that the entire App repository's pre-existing typecheck is green.
- `bun run check:may-design` passed with the existing unclassified `reports`
  warning, using the matching Host checkout for cross-repository references.
- `git diff --check` passed. No model-backed review run, Host deployment or live
  closure was performed.
