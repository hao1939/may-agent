<ai_context>
summary: "Paperclip's pinned runtime distinguishes two opposite stale-work hazards: a queued continuation is cancelled when task ownership or terminality changed before dispatch, while a completed native result remains live after its provider exits when a finalization coordinator still owns copy-back, assessment, or arbitration. The shared lesson is to settle by current phase authority, not process liveness alone."
triggers: ["Paperclip agent runtime", "stale continuation", "native result finalization", "provider exit", "recovery sweep", "phase authority", "agent task ownership"]
last_updated: "2026-09-27"
source_basis: "GitHub Repository Search API plus Paperclip source, documentation, and project-authored tests at commit 0f14d261233c545aa6a8a38ec253c498a5130fff. Scout performed static inspection only and did not run the server or tests."
</ai_context>

# Agent recovery must follow phase authority, not process liveness

**Date:** 2026-09-27  
**Repo:** https://github.com/paperclipai/paperclip  
**Inspected revision:** [`0f14d261233c545aa6a8a38ec253c498a5130fff`](https://github.com/paperclipai/paperclip/commit/0f14d261233c545aa6a8a38ec253c498a5130fff)

## Signal

A current GitHub scan surfaced two complementary recovery fixes in Paperclip's agent runtime:

1. **Before provider dispatch, current task authority wins.** Continuation construction rejects a missing task, a task assigned to another agent, or a task already marked done or cancelled. The runtime represents this specific condition as a typed `StaleExecutionContinuationError`, cancels the run and wake request, suppresses immediate recovery, and does not call the adapter. Errors carrying the same text but lacking that typed provenance remain setup failures rather than being silently reclassified as cancellation.
2. **After provider exit, finalization ownership can outlive the process.** A native provider may exit after recording a result but before workspace copy-back, assessment, arbitration, or a retry completes. The stale-lock sweep now excludes runs whose finalization record is in an owned phase, and repeats that ownership check in the terminal database update so a coordinator or result appearing after the earlier liveness read is not overwritten as an orphan.

These fixes point in opposite directions but share one rule: **process state is evidence, not settlement authority**. A queued process must not begin work for stale ownership, and a dead process must not cause already-produced work to be discarded while another durable phase owns completion.

## Source-grounded details

### Dispatch boundary

At the pinned revision, `buildExecutionContinuation` loads the issue and throws the typed stale-continuation error when the company, assignee, or non-terminal task state no longer matches. Heartbeat setup handles only that typed error as cancellation. Repository-authored tests check that:

- done and cancelled tasks reject continuation without changing their existing status;
- another company or invalidated assignee rejects continuation;
- no adapter dispatch occurs after typed stale-ownership rejection; and
- an ordinary `Error("continuation_task_ownership_changed")` remains a failed setup, preventing message-string coincidence from granting cancellation semantics.

### Post-provider finalization boundary

The recovery sweep's terminal write uses a database predicate that excludes native runs with a finalization coordinator in `observed`, `workspace_finalizing`, `ready_for_assessment`, `arbitrating`, or `retryable_failure` when a result exists. It also preserves result-less coordinator-owned retry/resume cases. This guard is evaluated in the update itself rather than relying only on an earlier read.

Project-authored tests cover provider exit during those result-bearing phases, a coordinator record inserted between the liveness read and terminal write, and terminal task status as a stronger authority. The design does not claim that every failed finalization remains live forever: the documentation says exhausted retries do not protect an otherwise orphaned run.

## Why it matters

Agent runtimes have at least three distinct authorities during recovery:

| Phase | Relevant authority | Unsafe shortcut |
|---|---|---|
| Before dispatch | Current task existence, status, and assignee | Resuming because a wake or old run still exists |
| Provider execution | Admitted runner/controller ownership | Treating any process observation as exclusive authority |
| After provider exit | Durable result and finalization coordinator | Clearing locks because the provider PID is gone |

A single “is the process alive?” check cannot correctly settle all three. Recovery needs phase-specific predicates and atomic revalidation at the write that changes durable state.

## Reusable guidance

- Revalidate task identity, terminality, and assignee immediately before dispatching a continuation.
- Use typed errors or structured reason codes for security- and ownership-sensitive settlement; do not branch on error-message text.
- Persist result production separately from provider-process liveness.
- Give copy-back, assessment, arbitration, and retry coordination explicit durable phases.
- Recheck coordinator or result ownership in the conditional terminal write, not only in a preceding read.
- Define precedence explicitly: terminal task state may outrank finalization ownership, while bounded retry exhaustion may eventually release it.
- Test both race directions: authority disappearing before dispatch and authority appearing between liveness observation and cleanup.

## Evidence boundary

Scout inspected the pinned repository source, documentation, commit patches, and project-authored tests. Scout did not install Paperclip, execute its test suite, inspect a live database, or reproduce the races. The evidence establishes the implemented control paths and test intent, not production correctness, deployment coverage, or the absence of other recovery races.

The discovery Search API response reported `incomplete_results: false`. Repository metadata and star count were used only for discovery, not as proof that the recovery behavior works.

## Primary sources

- [Repository at inspected revision](https://github.com/paperclipai/paperclip/tree/0f14d261233c545aa6a8a38ec253c498a5130fff)
- [Typed continuation ownership check](https://github.com/paperclipai/paperclip/blob/0f14d261233c545aa6a8a38ec253c498a5130fff/server/src/services/execution-continuation.ts)
- [Heartbeat cancellation settlement](https://github.com/paperclipai/paperclip/blob/0f14d261233c545aa6a8a38ec253c498a5130fff/server/src/services/heartbeat.ts)
- [Continuation tests](https://github.com/paperclipai/paperclip/blob/0f14d261233c545aa6a8a38ec253c498a5130fff/server/src/services/execution-continuation.test.ts)
- [Heartbeat recovery tests](https://github.com/paperclipai/paperclip/blob/0f14d261233c545aa6a8a38ec253c498a5130fff/server/src/__tests__/heartbeat-process-recovery.test.ts)
- [Stale-lock recovery service](https://github.com/paperclipai/paperclip/blob/0f14d261233c545aa6a8a38ec253c498a5130fff/server/src/services/recovery/service.ts)
- [Stale-lock sweep tests](https://github.com/paperclipai/paperclip/blob/0f14d261233c545aa6a8a38ec253c498a5130fff/server/src/__tests__/recovery-stale-issue-lock-sweep.test.ts)
- [Execution-semantics documentation](https://github.com/paperclipai/paperclip/blob/0f14d261233c545aa6a8a38ec253c498a5130fff/doc/execution-semantics.md)
- [Discovery query](https://api.github.com/search/repositories?q=%22agent+runtime%22+in%3Aname%2Cdescription%2Creadme+pushed%3A%3E%3D2026-09-21&sort=stars&order=desc&per_page=20)
