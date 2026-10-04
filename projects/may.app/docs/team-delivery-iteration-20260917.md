# Team delivery and recovery iteration

The failure under repair was lost evidence and rejected delivery after useful
team work. Long judgments accumulated inside a size-limited Task result, while
actual implementation responses and successful verification output were not
passed through to the reviewer. This is a May workflow repair using existing
Task/reconciliation facilities, with shared storage and recovery guidance.

## Rules and ownership

Keep the current requirement and execution lifecycle in the ordinary Task.
Retain full reports and observed receipts in files; return compact checksummed
references. Code retains and checks evidence; agents judge whether it proves the
outcome. Recovery reads current requirements and actual state before continuing
unfinished work. Rejected settlement does not erase effects or establish success.

The common rule is documented in
[the workflow contract](../../alex.app/docs/2a-design/execution-contributions.md#evidence-retention-and-autonomous-recovery)
and shared agent guidance. `shared/tools/task-evidence.ts` handles immutable
local records and checked reads without a Git repository, team names or a
scheduler. May owns the Git/requirement validity checks, verification argv and
Bob/tech-lead policy in [its development design](development-workflow.md).
Current receipts remain reachable by evidence kind through repeated failures;
there is no recent-history cutoff. SDK admission is the result-size authority.
A rejection retains its actual admission reason in feedback.

This supplies reusable recovery support; it does not automatically retrofit
every App, infer domain-specific validity, or guarantee unassisted recovery from
missing authority, credentials or uncertain external effects. No new Host
service, queue, database table or durable workflow controller was added.

## Review: does the procedure help the agent?

This repair found and removed concrete friction: the agent had to shorten useful
reports to fit delivery, evidence was lost between steps, and a history cutoff
could hide still-valid proof after repeated review failures. These are mechanical
burdens that code should handle.

A further regression reproduced a routing defect: after review requested design
reconsideration, Bob could choose to review the existing implementation, but
stale feedback still forced tech-lead to run. The workflow now honors that fresh
design judgment. Clean, unchanged code can proceed directly to review with its
valid verification receipt; the agent need not invent a change to satisfy a
stage. The regression failed before this fix and passes with it.

Two remaining restrictions deserve separate improvement:

- New Task input currently triggers conservative reassessment. Prior validity
  must be reconsidered, but this need not mean discarding useful context or
  repeating every check. A future refinement should let the agent assess new
  input with the old evidence visible and an explicit way to request fresh
  verification. Do not silently treat all new input as harmless.
- Bob's `read-only` preset supplies file reading, without file discovery or code
  search. The live trial still completed, but repeated reads and guessed paths
  show an observation gap worth testing with proper read-only search/list/diff
  capabilities. Granting arbitrary shell writes is not necessary for that.

The committed-candidate requirement and team sequence are opt-in development
policy. General research should be able to use evidence/recovery support without
adopting that pipeline. The principle is recorded in
[Choosing the right mechanism](../../alex.app/docs/1-principles/code-vs-data.md#code-should-help-agents-work).

## Validation

Portable May checks passed typechecking, formatting, **47 tests**, with one optional Host integration test skipped. Common design,
SDK example and canonical App checks also passed. Regression cases cover:

- Large ASCII/Unicode reports, preserving full bodies outside the result limit.
- Actual execution identity plus successful and failed command receipts.
- Changed source/requirements/input, interrupted edits and missing/corrupt files.
- Reusing rejected delivery without repeating model calls or verification.
- Current verification remaining visible after ten invalid review attempts.
- A fresh design choosing review without unnecessary implementation.
- Replacement readers and concurrent immutable publication for non-Git data.

The existing local instance ran the first repair at App source `9db25692e7` on
Host `3a8893ba11d196706b70812d4a93423f8c892207`. May received one documentation
assignment and selected its development route directly. Bob supplied design,
tech-lead authored and committed the report, the workflow ran the exact check,
Bob reviewed the candidate and receipts, and May read the result and fulfilled
the Request. No evaluator correction or additional instruction was sent.

The check's deliberately long stdout was **72,019 UTF-8 bytes**, with **27
stderr bytes**, preserved exactly. Its exit was zero and there was one
verification execution. The admitted Task result was **689 bytes**. All ten
artifact references passed independent checksum verification. The workflow
used three specialist calls; the complete conversation used five sessions and
80 recorded operations, taking about 4 minutes 51 seconds. No trial sessions
remained active. This smaller task is not a controlled speed/cost comparison
with the earlier Gym redesign trial.

The final shared implementation was also run through the actual compiled Host
workflow runner with copied facts and artifacts from the completed live Task.
Accepted-result replay and simulated rejected-settlement replay both converged
with unchanged evidence and zero agent steps. No model profiles were registered,
and the replay did not mutate the daemon Task. This proves evidence reuse in the
workflow runner; it is not a live crash/settlement-failure injection. The shared
non-Git checks demonstrate storage portability, not research acceptance policy.

The shell's root node_modules held an older SDK; an initial source-mode replay
therefore rejected the current result contract. Reproduction uses the compiled
Host import path and its exact SDK, matching the installed runtime. No source
release or production dependency was modified to make that harness pass.

## Retained evidence and limits

Evidence root: `/app/.state/review-pilots/may-team-delivery-20260917/`.
It contains the original input, admission, source preparation/activation
receipts, checks, Task/Conversation/session snapshots, exact output validation
and the isolated replay script/results.

The Request is `team-delivery-trial-20260917` in Conversation
`may:team-delivery-20260917`; it is closed fulfilled. Its ordinary Task is
`goal/app_9f3ab222-8ada-4367-ba4c-29538c45fe97`, observed converged. The sole
candidate document is `projects/may.app/docs/reviews/team-delivery-smoke-20260917.md`
in its retained worktree, at commit
`7ce94f11d48f3e8516da8c90b574f4f65dd97102`. That trial candidate was not merged.

The local Task worktree began at `df3501f446e3dbb8af8384cbd033da11c72a52cb`,
while active definitions contained the repair. Bob independently noticed the
source mismatch and required explicit citations to the installed release.
The report distinguishes those sources. This trial does not establish that
Task worktrees automatically start from the newest locally merged revision.

Evidence remains local and depends on retaining its worktree/output. No exact
step replay is promised for interruption before a Runtime-referenced result
exists. Cached checks assume the relevant environment has not changed. A
checksum establishes file identity, not semantic truth or a sandbox against
trusted code. The Gym design and its earlier research artifacts were not altered
or reassessed during this functionality iteration.
