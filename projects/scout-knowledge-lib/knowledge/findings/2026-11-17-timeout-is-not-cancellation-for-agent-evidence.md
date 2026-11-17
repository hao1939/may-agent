<ai_context>
summary: "Pinned Tightbeam source shows that a timed-out synchronous call can remain queued and mutate shared evidence after its caller has already degraded or moved on. Its countermeasure carries the caller's deadline with every mutating observation and rechecks it immediately before mutation, so delay can only weaken evidence rather than invent stronger attribution."
triggers: ["timeout is not cancellation", "late mutation", "deadline fence", "agent evidence", "abandoned call", "Tightbeam", "turn observation"]
last_updated: "2026-11-17"
source_basis: "GitHub repository discovery and static inspection of clickety-clacks/tightbeam at commit 9e39b5839014c8723f5c7b04746190647fffea9a: README, complete recursive tree metadata, turn-observation implementation, and artifact-carrier tests. Scout did not install or run Tightbeam or execute its tests."
</ai_context>

# A timeout is not cancellation: late agent calls need mutation-time fences

**Date:** 2026-11-17  
**Disposition:** New knowledge  
**Repo:** https://github.com/clickety-clacks/tightbeam  
**Inspected revision:** [`9e39b5839014c8723f5c7b04746190647fffea9a`](https://github.com/clickety-clacks/tightbeam/commit/9e39b5839014c8723f5c7b04746190647fffea9a)

## Question

What failure can remain after an agent control-plane caller times out, even when the caller correctly falls back to weaker evidence?

## Source observation

Current GitHub repository Search API queries for recently pushed AI-agent and orchestration repositories returned `incomplete_results: false` and surfaced Tightbeam, a gateway coordinating vendor coding-agent harnesses. Scout pinned the inspected default-branch revision before using repository contents. The recursive tree response was untruncated and contained 1,215 entries.

Tightbeam's `TurnObservations` process assigns an evidence class to artifacts recorded by an agent session. A pre-tool hook can open a short-lived window binding a later artifact record to the turn that invoked the tool, producing the stronger class `tool-call-observed`. If that observation path is unavailable, recording fails open to weaker `session-concurrent` or `none` evidence instead of refusing the artifact.

The subtle defect documented and guarded in the inspected source is that `GenServer.call` timeout does **not** remove its already-sent message from the server mailbox. An observation caller can time out and return a weaker result while its queued request is processed later. Without another guard, that abandoned request could still open an observation window, causing a subsequent unrelated artifact to be labelled `tool-call-observed`. The system would then fail in the unsafe direction: delay would manufacture stronger evidence after the caller had already treated the observation as unavailable.

The implementation couples the caller's two-second wait budget to a deadline carried inside each window-mutating request. The serialized writer checks that deadline on arrival and checks it again immediately before changing the window, after the potentially slow ledger read and pruning work. The second check is essential: a request can enter its callback before expiry but cross the deadline while blocked inside that callback. Read-only evidence requests do not need the same mutation fence, and writer unavailability remains visible as a diagnostic while the evidence class degrades.

The repository-authored artifact-carrier test forces this exact interleaving rather than sampling it. It queues an observation behind an occupied writer, then stalls the observation inside its ledger read until its caller has timed out. After releasing the stall, the test verifies that the writer remains alive, processes a mailbox barrier, and does not strengthen a later artifact beyond `session-concurrent`. This is producer-authored regression evidence; Scout did not execute the test.

## Reusable implication

Timeout handling in agent systems needs separate semantics for the **waiting caller** and the **effect-owning worker**. Returning `unknown`, retrying, or degrading a receipt only settles the caller's control flow. It does not prove that the timed-out operation was canceled or can no longer change shared state.

For requests that can alter authority, evidence, task state, publication state, leases, or approvals:

1. carry an absolute expiry or revocable operation identity with the request;
2. validate it at the effect boundary, not only before enqueue or callback entry;
3. repeat the check after every potentially blocking read and immediately adjacent to mutation;
4. make an expired request a no-op or a monotonic weakening, never a delayed strengthening;
5. preserve the timeout or unavailability cause separately from the resulting state; and
6. test the forced interleaving where the request starts before expiry but resumes after it.

A generation or ownership fence answers whether the actor is still authorized. A deadline fence answers whether the requester is still waiting for this operation. Systems often need both. The broader rule is: **a timeout is an observation by the caller, not cancellation of the callee's mailbox, process, network request, or external effect.**

## Relevance to May-style agent infrastructure

May already distinguishes attempts, accepted evidence, retries, and external effects. This source suggests a targeted audit question for any timed request that can later write evidence or state: after the caller times out, can queued or in-flight work still commit under the old request, and is expiry rechecked immediately at the mutation boundary? This is especially relevant where a fallback response may schedule a retry while the original operation remains capable of acting.

## Evidence limits

- Search results were complete only for the three recorded queries and returned pages, not for GitHub as a whole.
- Scout performed static inspection of one producer-authored repository revision and did not install the release, run the gateway, execute tests, reproduce timing behavior, inspect a deployment, or establish adoption.
- The inspected test demonstrates the intended Elixir-process interleaving in repository code; it does not prove equivalent fencing across every Tightbeam adapter, database path, network request, or external effect.
- Tightbeam's evidence classes and timeout values are project-specific. The reusable claim is the lifecycle boundary between caller timeout and later mutation, not that every delayed operation should use the same two-second budget or fail-open policy.

## Primary evidence

- [Repository](https://github.com/clickety-clacks/tightbeam)
- [Pinned revision](https://github.com/clickety-clacks/tightbeam/commit/9e39b5839014c8723f5c7b04746190647fffea9a)
- [Turn-observation implementation](https://github.com/clickety-clacks/tightbeam/blob/9e39b5839014c8723f5c7b04746190647fffea9a/lib/tightbeam/turn_observations.ex)
- [Forced-interleaving artifact-carrier tests](https://github.com/clickety-clacks/tightbeam/blob/9e39b5839014c8723f5c7b04746190647fffea9a/test/artifact_carrier_test.exs)
- [README and operating boundary](https://github.com/clickety-clacks/tightbeam/blob/9e39b5839014c8723f5c7b04746190647fffea9a/README.md)
- [Pinned recursive tree](https://api.github.com/repos/clickety-clacks/tightbeam/git/trees/9e39b5839014c8723f5c7b04746190647fffea9a?recursive=1)
