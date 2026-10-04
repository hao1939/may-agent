<ai_context>
summary: "OpenGeni's control-plane evidence shows that live direction and structured human input need operation-specific settlement boundaries. Steer may defer its interruption effect until compaction reaches a safe landmark; a frozen human-input tool call separately serializes answer, expiry, cancellation, and supersession under stable request identity and a generation fence."
triggers: ["agent steering", "context compaction", "safe point", "checkpoint transaction", "interrupt fence", "turn supersession", "structured human input", "settlement race", "generation fence", "durable control command", "agent runtime race"]
last_updated: "2026-10-04"
source_basis: "OpenGeni repository documentation, implementation, and repository-authored regression tests at pinned revisions f6223235f63b60c295566f81f84e2e72df14f410 and 5ccec09449de8a0eafd691c8fd940f9f0a86904f."
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

## Human input is a settlement boundary, not a chat message — October 2026 update

At revision `5ccec09449de8a0eafd691c8fd940f9f0a86904f`, OpenGeni's structured
human-input path applies the same broader principle to a different control seam.
`request_human_input` freezes one exact tool call and later supplies one typed
outcome—`answered`, `skipped`, `expired`, or `cancelled`—as that call's result.
Its stable request identity comes from the session, logical turn, and SDK tool-call
ID; the row separately retains immutable creation-attempt provenance and a mutable
execution-generation fence. Recovery may therefore advance the physical attempt
without changing the questions, deadline, or logical request.

Answer and expiry use one database settlement function. It locks the session and
request row, verifies that the active turn owns the request at the same generation,
and commits first-writer-wins. A client event ID makes a response retry return its
original terminal event without generating another event or wake. Already-terminal
expiry loses without acknowledging a human response. Historical cancelled rows
missing their canonical event have a separate one-time repair path that does not
wake terminal work.

The Temporal timer is deliberately not proof of expiry. If it fires slightly before
the database clock considers the persisted deadline elapsed, the database leaves the
request pending and the workflow waits on one bounded interruptible retry floor
instead of spinning or forcing settlement. Repository-authored database tests name
coverage for restart survival, idempotent resume, answer-versus-expiry races,
one-time cancellation repair, and one accepted response across parallel structured
input and ordinary approval interruptions.

Superseding input is semantic rather than incidental: Steer, terminal transitions,
and an ordinary Send while actively waiting cancel the frozen request and emit its
terminal tool result before replacement work proceeds. Pause instead preserves the
request. This prevents a new message, pause, or recovery attempt from being silently
interpreted as the answer to a different logical question.

**Runtime rule:** bind human input to a durable logical request, immutable question
contract, and current execution-generation owner. Serialize answer, expiry,
cancellation, and supersession as competing terminal outcomes; use stable retry
receipts; treat the database projection as actionable truth; and let workflow timers
request settlement rather than declare it. A visible form is not complete
human-in-the-loop support unless the reviewed question and accepted answer resume the
same frozen operation.

## Evidence limits

Both assessments are static inspection of project-authored implementation,
documentation, and tests, not independent production incident reports or comparative
benchmarks. Scout did not run OpenGeni's Bun/Postgres suite, reproduce the compaction
race, exercise a worker restart, or test answer/expiry concurrency. The evidence
supports concrete ordering and settlement patterns; it does not establish that
OpenGeni's entire lifecycle is race-free. The August commit is also large (827
changed lines across implementation, documentation, and tests), so that finding
should not be read as a minimal patch-size claim. The October assessment does not
validate OpenGeni's broader durability, sandboxing, credential, or multi-day-run
claims.

## Primary sources

- Repository overview: https://github.com/Cloudgeni-ai/opengeni
- Fix commit: https://github.com/Cloudgeni-ai/opengeni/commit/f6223235f63b60c295566f81f84e2e72df14f410
- Context-compaction contract: https://github.com/Cloudgeni-ai/opengeni/blob/f6223235f63b60c295566f81f84e2e72df14f410/docs/context-compaction.md
- Run-lifecycle contract: https://github.com/Cloudgeni-ai/opengeni/blob/f6223235f63b60c295566f81f84e2e72df14f410/docs/run-lifecycle.md
- Activity regression test: https://github.com/Cloudgeni-ai/opengeni/blob/f6223235f63b60c295566f81f84e2e72df14f410/apps/worker/test/context-compaction-activity.test.ts
- Control-plane implementation: https://github.com/Cloudgeni-ai/opengeni/blob/f6223235f63b60c295566f81f84e2e72df14f410/packages/db/src/session-queue-commands.ts
- October inspected revision: https://github.com/Cloudgeni-ai/opengeni/commit/5ccec09449de8a0eafd691c8fd940f9f0a86904f
- Structured human-input contract: https://github.com/Cloudgeni-ai/opengeni/blob/5ccec09449de8a0eafd691c8fd940f9f0a86904f/docs/human-input.md
- Human-input settlement implementation: https://github.com/Cloudgeni-ai/opengeni/blob/5ccec09449de8a0eafd691c8fd940f9f0a86904f/packages/db/src/index.ts#L42089-L42536
- Temporal wait and expiry loop: https://github.com/Cloudgeni-ai/opengeni/blob/5ccec09449de8a0eafd691c8fd940f9f0a86904f/apps/worker/src/workflows/session.ts#L823-L865
- Repository-authored database tests: https://github.com/Cloudgeni-ai/opengeni/blob/5ccec09449de8a0eafd691c8fd940f9f0a86904f/packages/db/test/session-human-input.test.ts
- October discovery query: GitHub Repository Search API `"AI agent" in:name,description,readme pushed:>=2026-09-27`, sorted by updated; `total_count: 106376`, `incomplete_results: false`.
