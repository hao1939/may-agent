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
| Unfinished legacy inbox rows | 4 | Stop historical handling without a result |
| Retained Conditions | 41 | Preserve original evidence; never invent satisfaction |

All 66 remaining Tasks have no current attempt. The four inputs have no Task
or Conversation admission and no result. Existing owner decisions account for
them: the [117-Task ledger](legacy-frontier-disposition-2026-10-04.json),
[current handover](migration-handover-current-2026-10-04.json),
[writer containment](workspace-writer-containment-reconciliation-2026-10-04.json)
and accepted May result `goal/appdep_f8259919c2fd5d38a366e230`.
The ledger's SHA-256 remains
`98f698e4fb24cb36b3890e9bd50f46e303c7c2e3e823c44cc4812dfd244410e3`.

Online controls require a loaded App runtime. Re-enabling retired controllers
to retire their records would risk replaying obsolete work. Generic offline
withdrawal tooling is proposed in
[Host PR #401](https://github.com/hao1939/may-agent/pull/401).
It requires reviewed exact preimages, a complete census, stopped Host/workers
and a verified offline backup. It uses canonical cancellation, preserving
accepted attempts; legacy inputs become stopped with null results and retain
caller/session/wait provenance. Unreferenced Conditions can be pruned through
canonical cancellation after their original bytes are archived. This is
withdrawal of responsibility, not successful fulfillment or observed recovery.

The exact installation plan, raw preimages, original Condition bytes and
accepted-attempt evidence are prepared privately beside the archive as
`retirement-plan.prepared.json`, `state-preimages.json.gz` and
`state-preparation-receipt.json`. These are a preparation snapshot, **not an
offline Host backup**. Production remains running and unchanged; the stopped
state must be freshly verified before any apply.

## Rehearsal and application boundary

The tool was rehearsed in memory using a reduced, consistent read-only snapshot
of the actual retired App records, all other Apps' Conditions and the exact
current May continuation Tasks. Dry-run restored every loaded table. Isolated
apply reduced 66 nonterminal Tasks and 4 unfinished inputs to zero, preserved
all accepted-attempt rows and current May Task/Condition evidence, and exact
replay made no changes. Canonical cancellation pruned 16 unreferenced retired
Conditions; 25 historical Conditions remained. Their preimages are retained.
This demonstrates the planned transition on those records; it does not report
production completion or authorize replaying old work.

The rehearsal found and fixed legacy `achieve`/`maintain` label compatibility
by reusing the Host's existing resource parser. Twenty focused regressions pass,
including stale evidence/census refusal, transaction rollback, CLI restart/replay,
legacy modes and preservation of independent authority waits. Detailed local
results are in `state-rehearsal-receipt.json` beside the archive; full Host CI
status belongs to PR #401.

Production withdrawal remains pending Host PR review/merge and the documented
offline apply. Preserve the existing release until that boundary is satisfied.
Then verify zero retired nonterminal Tasks/unfinished inputs, unchanged accepted
evidence and current May waits before restarting. No old controller is needed.

May's independent provider-authority Task
`goal/appdep_5f8a7c0e566e08fc95051414` remains waiting on actual authority.
The assignment-visibility continuation `goal/appdep_3be7de6fa2742a26d35f575b`
and retired Gym decision `goal/appdep_c1890444e02436f8d2131ffd` are closed.
Removing the filesystem alias or withdrawing the retired App's copy neither
closes nor satisfies a current May obligation.
