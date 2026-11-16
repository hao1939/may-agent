# First standalone improvement trial — November 16, 2026

## Outcome and achieved boundary

Manual stage execution is implemented and verified. A captured diagnosis failure
was replayed with Alex's existing Host-reviewed repair; standalone Alex judged
the evidence and chose the next bounded experiment. Standalone Bob reviewed the
new runner and returned pass with no required repairs.

These changes integrate the verified runner and reused diagnosis repair into
Apps source. Loaded App activation, fresh natural-work benefit and reduced human
correction/cost are unproved. The next snapshot experiment is prepared, not run.

The independently running Host assignment
`alex:input/app_26879531-1fa4-46fe-b4c3-1a0af6378ca8` completed before the manual
replay. Its reviewed candidate `5270d44359c0efa589dd4339d4a044c073b671c1` was reused
through its two source commits, preserving that work and its review evidence.
No Host Task was cancelled or created by the standalone runner.

## What we exercised

The [manual runner](standalone-stage.md) was reviewed at source commit
`a02c1378e40ca6885255d9d3dcc2dc75e86d8ba2`. Trials used an external linked worktree
and the SDK from the existing pinned installation
`/app/.state/runtime-installation/pr561-7d9b61be/source/packages/sdk`.

| Stage | Observed result |
| --- | --- |
| Deterministic fixtures | Real standalone diagnosis, blocked status, cancellation, evidence preservation, worktree isolation and import-error receipts passed. |
| Captured extraction replay | Both trials changed from pre-change `unknown` to authoritative `success`. An explicitly derived missing-result control exposed insufficient evidence. |
| Live Gym diagnosis | Completed in 8.430 seconds, retaining its proposal and session trail. Its Scout recommendation remained advisory. |
| Live Alex scope judgment | Completed in 36.384 seconds; supported the diagnosis mechanics locally and selected frozen candidate execution next. |
| Live Bob runner review | Completed in 20.670 seconds; pass with no required repairs. Bob inspected supplied source and saved test/design output, with stated review limits. |

Every live stage retained an exact input, standalone Task identity, source/SDK
provenance, SDK report, session paths and final receipt. Cleanup was confirmed
and the SDK fingerprint stayed unchanged in all three live invocations.

## What needed correction

The live diagnosis proposed a nonexistent
`projects/alex.app/agents/scout/AGENTS.md`. The actual Scout source is in
`projects/scout-knowledge-lib.app`. It also treated the historical machine verdict
as an actionable Scout problem and inferred verbosity waste from aggregate
tokens. The original artifact preserved the authoritative note and its links;
the historical labels do not establish current genuine truth approval, and
aggregate context tokens do not isolate verbosity. These limits were supplied
to Alex before the scope decision. No Scout instruction change was adopted.

Alex correctly selected the live-candidate execution defect, but its raw response
said candidate snapshot retention was absent. `projects/gym/src/loop/store.ts`
already copies and fingerprints `candidate_snapshot`. The prepared experiment
therefore reuses that storage and repairs execution resolution. Preserve the raw
response as evidence while following this corrected implementation premise.

These two operator corrections show why explicit manual inspection remains
useful. A successful helper return is insufficient to justify its recommendation.

## Verification and cost

- Runner and diagnosis verification: 16 tests passed, 0 failed.
- Existing development procedure verification: 44 tests passed, 0 failed,
  including real Git, checks, review and recovery.
- Runner typecheck and all four May design checks passed.
- Standalone Bob reviewed the exact runner candidate and found no required repairs.
- Three live invocations reported 102,306 aggregate tokens and approximately
  $0.3898 in model cost estimates. Actual billing is unverified. Aggregate tokens
  include repeated context; they are not a measure of output verbosity.

No behavioral improvement was inferred from these mechanics checks. Total human
effort and production operating-cost reduction were not measured.

## Evidence and the next session

The [retained session index](/root/workspace-worktrees/alex-standalone-20261116/.state/standalone-improvement/20261116-session-1/README.md)
links the declared experiment, copied inputs and hashes, extraction replay,
all invocation receipts/results, checks, usage and operator corrections.
The external worktree retains the candidate and ignored development state for
the next session.

The next hypothesis is: **every trial executing the retained candidate snapshot
will observe the same bytes even if the original live candidate is changed or
deleted between trials**. Stop or revise if any trial still reads live source,
snapshot corruption is silently accepted, or supported agent/workflow resolution
regresses.

A [prepared stage configuration](/root/workspace-worktrees/alex-standalone-20261116/.state/standalone-improvement/20261116-session-2/snapshot-stage.json)
uses the existing `alex/develop-change` procedure with `bun run gym:check` as its
verification command. It incorporates the operator correction about existing
snapshot retention. To begin that separate bounded experiment from the external
worktree:

```bash
bun projects/alex.app/scripts/standalone-stage.ts \
  .state/standalone-improvement/20261116-session-2/snapshot-stage.json
```

The first session stopped after its predeclared three live invocations. This
command has not been executed; no snapshot fix or full Host handover is claimed.
