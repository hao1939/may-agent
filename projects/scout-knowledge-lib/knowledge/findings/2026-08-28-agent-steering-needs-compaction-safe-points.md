<ai_context>
summary: "OpenGeni's fix for a race between live steering and context compaction shows that agent control commands need operation-specific safe points. A steer can be accepted durably while its interruption effect is deferred until the compaction checkpoint reaches a terminal landmark; then the old turn is superseded before further inference. Pause and Cancel retain immediate fencing semantics."
triggers: ["agent steering", "context compaction", "safe point", "checkpoint transaction", "interrupt fence", "turn supersession", "durable control command", "agent runtime race"]
last_updated: "2026-08-28"
source_basis: "OpenGeni repository documentation, implementation diff, and regression tests at commit f6223235f63b60c295566f81f84e2e72df14f410."
</ai_context>

# Agent Steering Needs Compaction Safe Points

Date: 2026-08-28  
Source: GitHub  
Repo: https://github.com/Cloudgeni-ai/opengeni  
Revision: `f6223235f63b60c295566f81f84e2e72df14f410`

## Signal

OpenGeni's August 28 fix for **Steer during active context compaction** exposes a
subtle control-plane race. Its normal Steer behavior immediately interrupts and
supersedes the live turn. During compaction, however, that interruption also
fences the transaction that must install or reject the new context checkpoint.
The intuitive policy—"new human direction always interrupts now"—can therefore
prevent the runtime from recording the safe state from which that direction
should continue.

The fix separates **command admission** from **command effect**:

1. accept the human/API or agent Steer as durable waiting work;
2. while the latest exact-attempt compaction landmark is
   `session.context.compaction.started`, do not insert the interruption fence;
3. let that attempt record `session.context.compacted` or
   `session.context.compaction.skipped`;
4. at that first safe boundary, settle the ordinary turn as `superseded` before
   another model request, then run the waiting Steer;
5. for a standalone maintenance compaction, finish the maintenance turn and
   claim the waiting Steer next.

The regression test makes the ordering explicit: compaction starts, Steer is
accepted with `deferredUntilCompaction: true`, compaction reaches its durable
terminal landmark, the old turn emits `turn.superseded`, and no post-compaction
inference is allowed before the steered turn is claimable.

## The broader pattern

Agent runtimes should treat cancellation semantics as a matrix, not one global
"interrupt" operation:

| Control | Admission | Effect during non-atomic work | Required handoff |
|---|---|---|---|
| Steer | immediate and durable | may defer to the next commit-safe boundary | supersede before any new inference |
| Pause | immediate | fence current execution | preserve recoverable state |
| Cancel | immediate | fence current execution | terminal settlement |

This resembles cooperative cancellation around database commits: responsiveness
is important, but an interrupt must not revoke the authority needed to publish
an already-started atomic state transition. The correct invariant is not
"Steer interrupts immediately." It is:

> Once Steer is accepted, no further inference follows the old direction, but
> any in-flight checkpoint transition first reaches an authoritative terminal
> state.

A robust implementation needs exact attempt identity and ordered durable
landmarks. Checking whether a compaction event ever existed is insufficient when
one turn can compact multiple times; the latest event for the current turn,
generation, and attempt must determine whether the critical section is open.
Receipts should also expose deferral so clients do not mistake accepted control
for completed interruption.

## Why this matters beyond context summaries

The same split applies whenever a live agent can be redirected during a
state-changing operation: snapshot installation, artifact publication, memory
promotion, tool-call commit, lease transfer, or sandbox checkpointing. For each
operation, the runtime should define:

- the authority fence that an interrupt would revoke;
- the durable event that marks the safe handoff;
- which controls must remain immediate despite partial work;
- how queued direction is prevented from triggering old-goal continuation;
- a test that forbids any old-direction model or tool call after the handoff.

## Evidence limits

This is evidence from one repository's implementation change and author-written
regression suite, not an independent production incident report or comparative
benchmark. The value is the concrete race and its testable ordering invariant;
it does not establish that OpenGeni's entire lifecycle model is race-free. The
commit is also large (827 changed lines across implementation, documentation,
and tests), so the finding should not be read as a minimal patch-size claim.

## Primary sources

- Repository overview: https://github.com/Cloudgeni-ai/opengeni
- Fix commit: https://github.com/Cloudgeni-ai/opengeni/commit/f6223235f63b60c295566f81f84e2e72df14f410
- Context-compaction contract: https://github.com/Cloudgeni-ai/opengeni/blob/f6223235f63b60c295566f81f84e2e72df14f410/docs/context-compaction.md
- Run-lifecycle contract: https://github.com/Cloudgeni-ai/opengeni/blob/f6223235f63b60c295566f81f84e2e72df14f410/docs/run-lifecycle.md
- Activity regression test: https://github.com/Cloudgeni-ai/opengeni/blob/f6223235f63b60c295566f81f84e2e72df14f410/apps/worker/test/context-compaction-activity.test.ts
- Control-plane implementation: https://github.com/Cloudgeni-ai/opengeni/blob/f6223235f63b60c295566f81f84e2e72df14f410/packages/db/src/session-queue-commands.ts
