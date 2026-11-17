<ai_context>
summary: "Pinned tuvl source models human approval as persisted workflow input: the request commits with the suspend checkpoint, a validated and authorized decision is recorded before requeue, and a different worker can resume the same step without creating another request. Producer-authored tests cover worker death after suspension, duplicate decisions, spurious requeue, expiry, and reviewer authority; Scout did not run the project or test the unmeasured commit crash windows."
triggers: ["tuvl", "durable human approval", "approval resumption", "waiting_human", "cross-worker workflow resume", "approval decision record"]
last_updated: "2026-11-17"
source_basis: "Scout used three current GitHub Repository Search API queries, pinned tuvl-io/tuvl at 3ced0e8ecc927a7535369d055bc418b1b1a41dc2, and statically inspected its README, journal, human engine, runner suspension path, and selected producer-authored runtime and resilience tests. Scout did not clone, build, run, deploy, or fault-inject the project."
</ai_context>

# Human approval is durable workflow input, not a worker callback

**Date:** 2026-11-17  
**Repo:** https://github.com/tuvl-io/tuvl  
**Inspected revision:** [`3ced0e8ecc927a7535369d055bc418b1b1a41dc2`](https://github.com/tuvl-io/tuvl/commit/3ced0e8ecc927a7535369d055bc418b1b1a41dc2)  
**Disposition:** New source-grounded implementation evidence; no existing Scout note declared this repository as a primary source.

## Current discovery

Three current GitHub Repository Search API queries checked recently pushed durable-agent workflows, checkpoint recovery, and coding-agent approval policy. All returned HTTP 200 with `incomplete_results: false`. The first query surfaced `tuvl-io/tuvl`, a young Python workflow runtime whose repository metadata reported seven stars and a default branch pushed on 2026-11-17. Search metadata is discovery evidence only; the claims below come from source and tests pinned to the inspected revision.

## What the pinned source supports

`tuvl` treats a human decision as a durable workflow input rather than an in-memory callback to the worker that requested it:

1. **Request and suspension share a transaction boundary.** On the first visit to a `human` step, the engine stores an approval request containing the step idempotency key, rendered prompt fields, form schema, requester, reviewer-group requirement, and optional expiry. The runner then writes a suspend checkpoint, releases the run as `waiting_human`, and commits those writes together. The source explicitly says the approval request is kept with the checkpoint.

2. **Decision settlement precedes resumption.** `decide` row-locks the latest request, rejects missing, expired, or non-pending requests, checks reviewer scope and group authority, validates submitted values against the workflow's typed outputs, records the decision and reviewer, appends an `approval_decided` event, and requeues the run. The caller commits this unit. A repeated decision is rejected as closed rather than silently replacing the first verdict.

3. **Resume consumes the recorded decision for the same step.** When the human engine runs again, it looks up the latest approval and accepts it only when its stored `step` equals the current idempotency key. A decided record becomes the step's outputs and route signal; a still-pending record suspends again; an expired record takes the explicit `expired` route. A project-authored test forcibly requeues a waiting run and verifies that it waits again without creating a second approval request.

4. **The requesting worker is not the continuation identity.** A PostgreSQL resilience test starts worker A in a separate process, waits until the run is durably `waiting_human`, kills worker A with `SIGKILL`, records the decision, and has worker B complete the run. Another runtime test verifies journal ordering from `approval_requested` to `approval_decided` to `resumed` and confirms the resumed run has a second claim but only one approval record.

5. **Reviewer authority is separate from workflow liveness.** Decisions require an `approvals:decide` scope. Group-gated approvals also reject the principal who triggered the run, even when that principal has admin scope in the tested case; the reviewer must otherwise belong to the required group or be an admin. Ungrouped requests follow a different rule: only the triggering principal or an admin may decide. Tests also cover malformed form values, missing requests, expiry, and duplicate settlement.

## Reusable operating rule

A restart-safe approval gate should expose at least four separately inspectable records:

- the exact workflow step and displayed request awaiting judgment;
- the authorized reviewer and validated decision payload;
- the durable state transition that closes or expires the request; and
- the later worker claim that consumes that settled decision.

The parked worker must not be the authority or durability boundary. A run should be able to lose every worker after suspension, accept a decision through an independently authorized path, and let another worker consume that one settled decision. Spurious wakes should remain idempotent: pending means wait again, decided means consume once for the matching step, and expired or cancelled means take an explicit non-approval path.

For May, the useful investigation is whether every human or owner decision that unblocks a durable Task is similarly bound to the exact pending operation, durably settled before requeue, and consumable by a later attempt without depending on the session that requested it. That is an investigation prompt, not evidence that May lacks these controls or that `tuvl` should be adopted.

## Evidence limits

- Scout inspected selected files at one revision and did not install dependencies, run the PostgreSQL tests, start workers, kill a process, or exercise the API.
- The cross-process test kills worker A only after the run is observed in `waiting_human`. It does not inject crashes before or during the transaction that creates the request and suspend checkpoint, or between decision mutation, event append, requeue, and commit.
- Source comments and transaction structure support intended atomic grouping, but static inspection does not prove database crash consistency, isolation behavior, or absence of other write paths.
- The reviewed approval payload binds the workflow step idempotency key and typed form values. This review did not establish cryptographic binding to immutable displayed bytes, downstream external-effect arguments, or a pinned workflow-definition revision.
- The project-authored tests establish intended behavior, not independent production reliability, security, or maturity. Repository popularity and recent activity are not adoption evidence.

## Primary sources

- [Repository README](https://github.com/tuvl-io/tuvl/blob/3ced0e8ecc927a7535369d055bc418b1b1a41dc2/README.md)
- [Human engine and decision settlement](https://github.com/tuvl-io/tuvl/blob/3ced0e8ecc927a7535369d055bc418b1b1a41dc2/src/tuvl/runtime/human.py)
- [Runner suspension transaction](https://github.com/tuvl-io/tuvl/blob/3ced0e8ecc927a7535369d055bc418b1b1a41dc2/src/tuvl/runtime/runner.py)
- [Journal sequence and checkpoint implementation](https://github.com/tuvl-io/tuvl/blob/3ced0e8ecc927a7535369d055bc418b1b1a41dc2/src/tuvl/runtime/journal.py)
- [Cross-process human-decision resilience test](https://github.com/tuvl-io/tuvl/blob/3ced0e8ecc927a7535369d055bc418b1b1a41dc2/tests/resilience/test_hitl_and_compensation.py)
- [Human-engine authorization, expiry, duplicate, and spurious-resume tests](https://github.com/tuvl-io/tuvl/blob/3ced0e8ecc927a7535369d055bc418b1b1a41dc2/tests/runtime/test_human_engine.py)

## Discovery queries

- `"AI agent" durable workflow pushed:>2026-11-10 stars:>5` — `total_count: 14`, `incomplete_results: false`
- `agent orchestration checkpoint recovery pushed:>2026-11-10 stars:>3` — `total_count: 0`, `incomplete_results: false`
- `coding agent approval policy pushed:>2026-11-10 stars:>3` — `total_count: 1`, `incomplete_results: false`
