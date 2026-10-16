# Host recovery confirmation and evidence — October 17, 2026

**Status:** [Host #376](https://github.com/hao1939/may-agent/pull/376) merged at
`68bc5c7cf688c6563ca61681cd20a881865ac23b` on 2026-10-16 19:41 UTC.
Verification below applies to candidate `7ef21a660`. Deployment was not established
by this review.

**Supports:** [Purpose and value](../../1-principles/purpose.md): keep useful work
accountable through failures without requiring people to reconstruct what happened.

**Choice basis:** [Agents judge; code executes and brings back evidence](../../1-principles/core-principles.md#code-executes-and-brings-back-evidence-agents-judge)
and [simple first](../../1-principles/core-principles.md#simple-first).
The [runtime contract](../../2a-design/runtime.md#recovery) owns this behavior;
the [Host plan](../../proposals/host-contract-improvements-20261016.md#4-give-execution-recovery-one-mechanical-meaning)
tracks broader recovery coverage.

## What was broken

At Host `e982e7537`, the private session adapter's boolean had inconsistent
consequences. Controller claim replacement rejected `false`; startup silently
kept the old attempt; terminal-session lease recovery could ignore it and release
that attempt. Failed process drain already threw an error. Missing metadata could
return `false`, leaving callers to interpret the same uncertainty differently.

The adapter also wrote `recovery.disposition: "requeued"` and a summary saying
the Task was requeued. It had only reconciled the session. Its caller could still
fail before releasing or requeueing the Task. An agent reading the artifact could
therefore receive an assertion stronger than the recorded execution facts.

A follow-up trial found the opposite error too: when a committed finish result
omitted its optional summary, recovery used the interrupted-session fallback and
claimed no committed finish existed. The result itself was preserved, but its
description contradicted it.

This is a reproduced source defect. The trial did not identify a live overlapping
worker incident or measure production token savings.

## Smallest correction

The shared recovery wrapper requires positive confirmation and otherwise throws
a specific failure. All callers therefore retain ownership on an unconfirmed
result. The adapter reports missing authoritative metadata explicitly, while
incomplete optional transcripts/checkpoints remain usable evidence.

The session artifact now says `interrupted` and points to the Task's current
state for accepted work and remaining obligations. The Task runtime continues to
record actual release/requeue. No historical artifact is rewritten. No SDK
schema, new lifecycle, recovery controller or Host-selected App strategy is added.
A recovered finish without a summary gets a factual description of the retained
finish; it still does not claim Task acceptance or fulfillment.

## Connected trial

A synthetic App declares an ordinary `handler.failed` subscription selecting one
diagnostic Task. The original Task has an expired retained attempt and a terminal
session artifact; the real session adapter's injected process drain cannot confirm
cleanup. The production controller emits the failure, the database retains it,
and ordinary App admission delivers it to executable Task work.

The scripted agent receives the Task/session references and drain failure. It
chooses to wait with a future review time; normal settlement accepts that decision.
The original Task's attempt and claim stay unchanged, and no replacement agent
runs. Once the fixture confirms cleanup, ordinary recovery allows the original
Task to execute and retain its result. The diagnostic decision alone never
authorizes replacing the old execution.

The test checks both accepted Event delivery and the diagnostic Task's accepted
decision. It proves more than saving an error. It does not prove a live model
would choose well, install this routing into a real App, or select investigation
policy for Apps.

## Verification and limits

The initial focused regression run reproduced five failures: two false requeue
artifact assertions, missing metadata returning silently, silent startup recovery,
and terminal-session recovery releasing an unconfirmed attempt. The existing
claim path already rejected the unconfirmed result.
The omitted-summary case also failed before its fallback description was corrected.

The first connected fixture returned a waiting decision without a return route,
then supplied an ISO string where normalized `reviewAt` requires epoch
milliseconds. Both were correctly rejected. The corrected fixture uses the
existing numeric review time; no production contract change was needed.

The full affected suite initially found one old assertion expecting startup to
resolve silently on missing metadata. It now asserts the explicit failure while
preserving the same ownership checks. At candidate `7ef21a660`, the two affected
suites passed all 256 tests and 3,140 assertions. Final local `bun run ci` passed:
3,791 tests, three existing installation-only checks skipped, zero failures and
21,828 assertions. GitHub Quality and Container checks passed on the same revision.
Design checks passed with the existing unclassified `reports` layout warning.

Reproduce from the Host repository with its supported Node and Bun versions:

```sh
bun install --frozen-lockfile
bun test src/app/adapters/executors/session-recovery.test.ts src/app/core/tasks/app-task-runtime.test.ts
bun run ci
```

The shared adapter and a controlled alternative response cover caller semantics.
This is not a separate executor's live process test. The connected trial injects
an unconfirmed drain result; controller dispatch retries remain separately
backed off, capped at a 30-second delay, with no new exhaustion policy. The
App's existing operational routing or audit decides when to investigate. A
passing scripted trial is not proof of live delivery or reduced cost.

Source review and merge are complete; rollout verification remains separate.
The change is internal to Host and independent of App policy; current guidance states that Host
records facts and the agent chooses how to handle unresolved work.
