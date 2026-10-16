<ai_context>
summary: "OpenGeni's control-plane evidence shows that live direction, structured human input, and effective session policy need operation-specific ordering boundaries. Steer may defer its interruption effect until compaction reaches a safe landmark; human input serializes terminal outcomes under stable request identity; policy reads distinguish accepted work from later default changes while bounding history scans."
triggers: ["agent steering", "context compaction", "safe point", "checkpoint transaction", "interrupt fence", "turn supersession", "structured human input", "settlement race", "generation fence", "durable control command", "agent runtime race", "effective session policy", "model settings boundary", "bounded history projection"]
last_updated: "2026-10-16"
source_basis: "OpenGeni repository documentation, implementation, and repository-authored regression tests at pinned revisions f6223235f63b60c295566f81f84e2e72df14f410, 5ccec09449de8a0eafd691c8fd940f9f0a86904f, and 2fef1581bde09fef020e3055c89490cd9fede175."
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

## Effective policy must preserve admission order without scanning the whole session — October 16 update

A current OpenGeni change at revision
`2fef1581bde09fef020e3055c89490cd9fede175` shows that a long-lived agent's
configuration is not simply “the newest value” in either its session row or event
log. An explicit model-settings write changes defaults for future work, but it must
not rewrite already accepted turns. Conversely, an automated turn accepted before
that write must not become the effective default merely because recovery starts it
later. A later human or API turn queued after the write may carry its own model again.
The implementation therefore orders policy by the original `turn.queued` admission
for human/API work while retaining `turn.started` as the separate identity of what
actually executed.

The previous query joined and sorted all start events and turns. The replacement
walks `turn.started` events newest-first, probes candidate turns by primary key, and
stops at the first eligible turn; when a `session.model_settings.updated` boundary
exists, it does not inspect starts before that boundary. Stored defaults, the settings
boundary, and the selected started turn are read in one database statement snapshot,
so a concurrent settings write cannot pair a newer boundary with stale row defaults.
The placement of `coalesce` inside the scalar subquery is also deliberate: under
PostgreSQL row-level security, an outer non-leakproof expression could demote the
sequence bound from an index condition to a filter.

A repository-authored PostgreSQL plan test synthesizes 1,500 turns and checks both
custom and generic prepared plans. It expects one walked start for the newest model,
zero after a settings boundary, and one for a later human turn, with fewer than 300
shared/read blocks. This is stronger than a benchmark anecdote because it checks the
query plan under the application role and row-level security, but Scout did not run
the test or inspect the claimed production-sized database comparison.

**Runtime rule:** retain separate identities for work admission, execution start,
and mutable defaults. Derive effective policy in one snapshot, and optimize by a
semantic stopping boundary rather than truncating history arbitrarily. Performance
work on durable logs must prove that it preserves the ordering rule—especially when
recovery can start old accepted work after a newer configuration write.

## Evidence limits

All three assessments are static inspection of project-authored implementation,
documentation, and tests, not independent production incident reports or comparative
benchmarks. Scout did not run OpenGeni's Bun/Postgres suite, reproduce the compaction
race, exercise a worker restart, test answer/expiry concurrency, or reproduce the
query-plan measurements. The evidence supports concrete ordering, settlement, and
bounded-projection patterns; it does not establish that OpenGeni's entire lifecycle
is race-free or that the stated database costs generalize to other workloads. The
August commit is also large (827 changed lines across implementation, documentation,
and tests), so that finding should not be read as a minimal patch-size claim. These
assessments do not validate OpenGeni's broader durability, sandboxing, credential, or
multi-day-run claims.

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
- Bounded effective-policy commit: https://github.com/Cloudgeni-ai/opengeni/commit/2fef1581bde09fef020e3055c89490cd9fede175
- Effective-policy implementation: https://github.com/Cloudgeni-ai/opengeni/blob/2fef1581bde09fef020e3055c89490cd9fede175/packages/db/src/session-execution-policy.ts
- Application-role query-plan test: https://github.com/Cloudgeni-ai/opengeni/blob/2fef1581bde09fef020e3055c89490cd9fede175/packages/db/test/effective-session-policy-plan.test.ts
- October 16 discovery query: GitHub Repository Search API `(agentic OR "AI agent") durable execution in:name,description,readme pushed:>2026-10-01`, sorted by updated; `total_count: 34423`, `incomplete_results: false`.
- Earlier October discovery query: GitHub Repository Search API `"AI agent" in:name,description,readme pushed:>=2026-09-27`, sorted by updated; `total_count: 106376`, `incomplete_results: false`.
