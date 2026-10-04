# Shared agent/workflow execution — 2026-09-17

**Historical context:** [Workflow Discovery And Execution](../../2a-design/workflows.md). Retained rationale and evidence; this record does not define the current contract.

Status: implemented and exercised in four local trials on the existing
instance. No remote rollout or merge is claimed.

The owning contracts are [Workflow execution](../../2a-design/workflows.md)
and [Event routing](../../2a-design/events.md#routing-outcomes). Host candidate
`a370feed` carries one live Task execution context through managed-agent,
workflow and Conversation entry points. Host follow-up `ea770799` fixes the
public-input-to-live-feedback path. Paired executable App definitions are
`88f3c4ee0a0826fb94841f7a3eff9ff8832cc919`.

The context contains existing fenced capabilities and snapshots; it is not
serialized as another work state. Shared managed execution owns feedback
subscriptions and cleanup. Model workflow invocation uses exact caller session
identity, structured input and the caller's remaining execution allowance.
Task-owned history recovers through its Task. Ordinary Git-backed agent Tasks
receive the same allocated worktree as workflows that require one. Definitions
can consist entirely of App-local agents; an absent global agents folder does
not make the release invalid.

The first live team trial exposed two gaps beyond the original context test:
explicitly targeted messages entered the default Conversation, and an App input
whose targetTaskId was in the payload never reached envelope-only live routing.
The follow-up gives explicit Task input precedence and shares one address reader
between admission, Task listeners and process relay. It accepts the existing
input address and envelope form, rejects conflicts, and preserves stored
envelopes/idempotency identities. No new queue, subscription service, event type
or workflow lifecycle was added.

Portable tests exercise the real loader, workflow runner and managed agents with
synthetic provider responses. Concurrent same-name callers retain distinct Task
contexts. Feedback reaches only the matching specialist and remains
unacknowledged. Cancellation drains callers/helpers and removes subscriptions.
The added public-input test exercises the actual interface, persistence, App
admission and Task observation, including retry identity, Conversation precedence,
invalid input and conflicting targets. Its Task executor is a fixture. The real
process relay test separately covers the input address across IPC. Existing
Task-runtime tests cover durable input, result fences and restart.

The first live trial selected the workflow from an ordinary goal and executed
May → Bob → tech-lead → Bob under one Task. A saved correction was handled on a
later attempt despite the missed live hint, with prior evidence retained. This
is evidence for recovery, not successful live notification. A mistakenly routed
Conversation test request was explicitly withdrawn. The initial test also gave
source paths unavailable inside the container; the reviewer disclosed that
limitation. The next trial used accessible source copies.

These checks do not establish semantic understanding of arbitrary corrections,
preemption of synchronous JavaScript or durable continuation of await. A hint
is not input acceptance; a subsequent Task pass may still be required. Provider
operations without supported cancellation/observation retain their own limits.
The [May iteration](../../../../may.app/docs/shared-execution-iteration-20260917.md)
owns team-policy changes, live output assessment and domain evidence reuse.

## Final verification

Host `ea770799` passed `bun run ci`: 3,080 passed, 3 installation-only checks
skipped, 0 failed; 13,790 assertions across 308 files. The App implementation
passed 50 checks with one optional integration skipped; design checks passed.
The running binary embeds `ea770799`; local readiness passed after activation.

The corrected live path delivered a targeted message while tech-lead was inside
May's selected workflow. The exact requested sentence appeared in its active
session and in candidate `d5aeb5503c088dc6b4775ea24a675d50d0d6e637`. Bob reviewed
it, and May independently read the report/evidence and checked the sentence.
A subsequent Task pass incorporated pending input using retained work, with no
second workflow run. The Task converged and preserved checksummed evidence.

A separate Task was cancelled while May awaited Bob. The public Task view
reported cancelled; both sessions ended with Request-aborted errors, the workflow
ended with an error record, and execution drained in approximately 1.1 seconds.
No replacement execution appeared in the later inspection. The other report Task
continued. This proves cancellation of the tested model call, not arbitrary
external subprocesses or rollback of completed effects.

An informational follow-up on the completed report reused the same commit,
workflow run and evidence references. Only May ran again; no specialist or
workflow was relaunched. Independent inspection verified the clean commit,
sole changed report, exact correction and both retained artifact checksums.
The local instance was idle at final inspection.

This iteration did not interrupt the Host during active model work. Restart
behavior is covered by portable runtime tests, not a new live restart trial.
These small directed team assignments also do not establish that May will choose
the right procedure for every open-ended request. Bob still has no file-listing
or code-search tools in its read-only preset; failed path guesses remain visible
review friction. That capability gap is separate from shared execution.

Local commands, receipts, transcripts references and the independent inspection
are retained under `.state/review-pilots/may-shared-execution-20260917/`, especially
`review-results.json`, `trial-2-correction.json`, `trial-3-result.json`, and
`trial-4-result.json`. These operational artifacts are not portable CI fixtures.
