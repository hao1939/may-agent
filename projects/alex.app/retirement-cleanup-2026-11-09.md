# Retired maintenance App cleanup — 2026-11-09

The May–Alex–Scout organizational migration is complete. The old maintenance
App is absent from the live catalog and loaded definitions. Its executable
source was removed earlier and Alex's migration Task
`input/app_7a279469-7ac8-4bec-894a-9314635bd452` is closed.
This receipt distinguishes completed filesystem retirement from the remaining
stored-state withdrawal operation. No historical outcome is newly fulfilled.

## Completed filesystem retirement

The ignored `projects/may-agent.app` symlink has been removed. Its target,
`projects/alex.app/archive/retired-apps/may-agent/local`, was moved intact to
`~/workspace-archive/may-app-retirement-20261109/may-agent-local` outside the
active checkout. Prefixes naming either old location resolve through that map.
The curated Alex docs, knowledge and retired-App archive remain in place.
Original Task references and dated handover records are preserved verbatim.

The same-filesystem move preserved 19,570 entries: 17,845 regular files
(144,981,828 file bytes), 250 symlinks, 1 historical FIFO and 1,474 directories.
Before/after inventories match on file hashes, link targets, modes, owner/group
and modification times. Local historical databases, WAL/SHM files and
reproducible dependencies were preserved together. No production database was
moved or edited. Descriptor inspection found no open archived file among
readable processes; unavailable process namespaces are recorded in the private
receipt, rather than claimed as inspected.

Private relocation evidence lives beside the relocated payload:
`relocation-receipt.json`, `local-inventory.before.json` and
`local-inventory.after.json`. The earlier
`~/workspace-archive/may-app-retirement-20261004/retired-apps.before.tar.gz`
was independently verified against SHA-256
`c9891f5fa1fae02181d54ed0bbb48457ee31ecd9b9323e4e24ef1e11e08d6920`.
This retained local payload does not resolve May's separate provider/archive
recovery obligation.

Current entry docs now identify retired methods and review targets accurately.
The Host source repository `projects/may-agent` and human-facing App
`projects/may.app` remain active and independent of the removed alias.

## Remaining production state

The exact query-only census of App `may-agent` is:

| Records | Count | Disposition |
| --- | ---: | --- |
| Retained Task resources | 119 | Preserve identity and accepted evidence |
| Resources with terminal records | 53 | Preserve existing decisions |
| Original 117-frontier resources without terminal records | 64 | Apply reviewed obsolete-record withdrawals |
| Additional retired controller resources | 2 | Withdraw retired controller responsibility |
| Unfinished legacy inbox rows | 4 | Two unadmitted; two require exact admitted-caller settlement |
| Retained Conditions | 41 | Preserve original evidence; never invent satisfaction |

All 66 remaining Tasks have no current attempt. All four inputs have null inbox
Task/Conversation attachment columns and no result. PR review corrected an
inference in the original receipt: null links do **not** prove no admission.
Two historical handling inputs retain eleven differing durable Task admissions:
`app_b1662085-dda4-498b-b6dc-374d94ab163d` (eight) and its child
`app_8633038c-432d-4e5a-a492-2211c107b141` (three). Those admission records have
no accepted-result binding; their differing Task/generation identities still
prevent treating them as unadmitted or choosing one alias without adjudication.
The two pending inputs have no matching durable admissions.

Existing owner decisions account for the semantic dispositions: the [117-Task ledger](legacy-frontier-disposition-2026-10-04.json),
[current handover](migration-handover-current-2026-10-04.json),
[writer containment](workspace-writer-containment-reconciliation-2026-10-04.json)
and accepted May result `goal/appdep_f8259919c2fd5d38a366e230`.
The ledger's SHA-256 remains
`98f698e4fb24cb36b3890e9bd50f46e303c7c2e3e823c44cc4812dfd244410e3`.

Online controls require a loaded App runtime. Re-enabling retired controllers
to retire their records would risk replaying obsolete work. Generic offline
withdrawal tooling merged in
[Host PR #401](https://github.com/hao1939/may-agent/pull/401) at
`f29d3132535e2b01d7b5196141e2f62de7070f8b` on 2026-11-09 (Shanghai).
The merge does not apply the installation plan or deploy the Host.
It requires reviewed exact preimages, a complete census, stopped Host/workers
and a verified offline backup. It uses canonical cancellation, preserving
accepted attempts; eligible unadmitted inputs become stopped with null results and retain
caller/session/wait provenance. Unreferenced Conditions can be pruned through
canonical cancellation after their original bytes are archived. This is
withdrawal of responsibility, not successful fulfillment or observed recovery.

The exact installation plan, raw preimages, original Condition bytes and
accepted-attempt evidence are prepared privately beside the archive as
`retirement-plan.prepared.json`, `state-preimages.json.gz` and
`state-preparation-receipt.json`. These are a preparation snapshot, **not an
offline Host backup**. The original prepared plan is now **blocked**, not ready
for application: the complete-census operation refuses its admitted inputs.
Preserve it as evidence; do not remove blocked rows from the census or delete
admissions to make it pass. Production remains running and unchanged. Resolve
the exact admitted-caller settlement first, then prepare and freshly verify a
new complete plan against stopped state before any apply.

## Rehearsal and application boundary

An earlier isolated rehearsal used a reduced, consistent read-only snapshot of
the retired App, all other Apps' Conditions and exact May continuations. It
reduced 66 nonterminal Tasks and 4 unfinished inputs to zero and preserved the
loaded accepted-attempt/current-May evidence, but it **missed durable admissions
behind null inbox links**. Its result is superseded as application evidence by
PR #401's review correction; it does not demonstrate a safe complete retirement.
The original `state-rehearsal-receipt.json` remains a historical trial record.

The corrected Host operation checks canonical and historical admission keys
and retained request identities inside the transaction. Rehearsing the original
plan now refuses it before any writes. A query-only live cross-check confirms
two admitted inputs and eleven retained aliases. The private
`review-correction-receipt.json` records those exact bindings and supersedes the
old rehearsal's applicability. No production state was changed in either trial.

Thirty-five focused regressions passed on the reviewed revision, including accepted answers whose inbox
links were never projected, unanswered admissions, input-only CLI retirement
without activating Task authority, complete-census refusal, reason whitespace,
legacy modes, rollback, completion-receipt preservation, cross-App control-key
isolation and preservation of independent authority waits. The merged operation
source matches that reviewed revision. Full Host CI status belongs to PR #401.
The saved preparation snapshot contains no receipt-ended Task among its 66
nonterminal candidates, so the generation-census correction leaves that count
unchanged. This is a snapshot audit, not a new live census.

The initial Host source prerequisite is satisfied. Production withdrawal still
requires reviewed support for the two admitted caller boundaries, a freshly
verified complete plan, and the documented offline apply with a verified backup. Preserve all admission
and accepted-attempt evidence; an existing semantic withdrawal is not permission
to erase an admission or invent a result. Verify the retired terminal census
and unchanged current May waits before restarting. No old controller is needed.

May's independent provider-authority Task
`goal/appdep_5f8a7c0e566e08fc95051414` remains waiting on actual authority.
The assignment-visibility continuation `goal/appdep_3be7de6fa2742a26d35f575b`
and retired Gym decision `goal/appdep_c1890444e02436f8d2131ffd` are closed.
Removing the filesystem alias or withdrawing the retired App's copy neither
closes nor satisfies a current May obligation.

## Explicit caller withdrawal candidate

The 2026-11-09 cleanup request prompted a separate review of the two August
owner-review callers. Their eleven differing aliases bind historical Tasks and
generations; none has a selected accepted answer. The saved snapshot also has
no converged accepted attempt or completion receipt at those admitted generations.
The candidate decision withdraws these obsolete callers **unfulfilled**, retaining
their original requirements, missing proof and independent current obligations.
It does not choose an alias or substitute an unrelated later Task's result.

[Host PR #410](https://github.com/hao1939/may-agent/pull/410) adds explicit
`admissionWithdrawal` with the complete raw admission preimages. Existing plans
still refuse admissions. Bound answers, newer accepted attempts explicitly scoped
to the admission, and completion evidence at the admitted generation require
separate exact answer settlement. A converged legacy Task at that generation
also blocks withdrawal when it retains the only answer payload. All admission bytes,
accepted attempts, completion receipts and prior terminal decisions remain intact.

The private `retirement-plan.admitted-withdrawal.candidate.json` contains 66 Tasks,
four inputs and eleven admission preimages. Its isolated in-memory rehearsal
reached zero nonterminal Tasks and zero unfinished inputs, retained 25 historical
Conditions after canonical pruning, and preserved all loaded admission, accepted,
completion, prior-terminal and current May evidence. Dry-run restored every loaded
table; replay made no changes. The new
`state-admitted-withdrawal-rehearsal-receipt.json` records that trial separately
from the original refused plan and superseded trial.

PR review added the newer scoped-answer and legacy Task-only answer guards.
Auditing the saved snapshot found neither condition among the eleven admission
preimages. The corrected in-memory rehearsal still reaches the same terminal
census and protected-evidence hash; its separate
`state-admitted-withdrawal-review-rehearsal-receipt.json` preserves that result.

This is a candidate based on the saved preparation snapshot, not a fresh live
census, an offline backup, or production application. PR #410 requires review and
merge before use. Then stop the Host and workers, verify the backup and exact
current preimages, prepare the final plan and run the offline procedure. The
original plan remains blocked. Production state remains unchanged by this work.

A further observed-generation review of PR #410 supersedes the successful
rehearsal's applicability. Requirements can advance while a Task retains an
older accepted observation, and canonical cancellation replaces its projected
summary, response and result. Source `e505000123` checks the caller's answer at
`status.observedGeneration` and requires the exact projected payload to survive
on the accepted observed attempt before any planned Task cancellation. This
also protects newer outcomes without answering an older caller by implication.

The saved candidate now correctly refuses: nine historical Task projections
lack sufficient retained accepted evidence (one waiting, six attention, two
converged). Separate exact outcome preservation/cutover is required; do not
manufacture acceptance or discard those payloads to make retirement pass.
`state-admitted-withdrawal-observed-generation-rehearsal-receipt.json` records
both dry-run and in-memory apply refusal, with every loaded table unchanged.
The saved census remains 66 nonterminal Tasks, four unfinished inputs and 41
Conditions. Previous successful rehearsal receipts remain historical evidence.
The candidate remains blocked, and production state remains unchanged by this
review. This is still a saved-snapshot finding, not a fresh live census.
