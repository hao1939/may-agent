<ai_context>
summary: "GitHub assessment of jin-bo/agentao at pinned revision 4d90377: cancellation was misreported as failure because a lower runtime layer absorbed the cancellation exception; the repair derives every public terminal state from the canonical returned outcome while keeping status, failure detail, work-so-far, and harness-authored notices distinct."
triggers: ["agent cancellation", "terminal state", "sub-agent lifecycle", "absorbed exception", "partial result", "Agentao", "cancellation race", "host contract"]
last_updated: "2026-09-17"
source_basis: "GitHub repository Search API discovery plus repository metadata, pinned commit diff, pinned source files, and committed regression tests for jin-bo/agentao revision 4d90377ca67ef1fe960de8b2da3f9ed6cea91f47. Tests were inspected, not run by Scout."
</ai_context>

# Agent Cancellation Must Settle From the Canonical Outcome, Not Exception Flow

## Question

How should an agent runtime classify and expose cancellation when a lower layer
absorbs the cancellation exception, and what evidence should remain available
after cancellation?

## Source and coverage

- **Repo:** https://github.com/jin-bo/agentao
- **Inspected revision:** [`4d90377ca67ef1fe960de8b2da3f9ed6cea91f47`](https://github.com/jin-bo/agentao/commit/4d90377ca67ef1fe960de8b2da3f9ed6cea91f47)
- **Observation date:** 2026-09-17
- **Discovery:** GitHub Repository Search API query `"AI agent" (authorization OR audit OR evaluation OR sandbox) pushed:>=2026-09-17`, sorted by update time; HTTP 200, `incomplete_results: false`, 20 items returned from 1,121 matches.
- **Read:** repository metadata and README; complete pinned commit message and file diff; pinned `agentao/agents/tools/_wrapper.py`, `agentao/runtime/turn.py`, and `tests/test_subagent_cancelled_terminal_state.py`.
- **Not done:** Scout did not install the package, run its tests, inspect all 1,326 repository-tree entries, or validate production use.

## Repository claim and implementation evidence

The pinned commit fixes a race-shaped reporting defect. A sub-agent cancelled
before starting already settled as `cancelled`, but one cancelled while running
settled as `failed` across its task record, lifecycle event, notification, and
CLI surfaces. The repository explains why: wrapper code expected to recover
cancellation from `except AgentCancelledError`, while `runtime/turn.py` had
already caught that exception, converted it to a `TurnOutcome` with
`status="cancelled"`, and returned normally. The same user action therefore
acquired different terminal meanings based on timing and abstraction layer.

The repair introduces one `_terminal_state()` mapping from the classified turn
outcome and uses it on both foreground and background paths. At the inspected
revision:

- an answered run maps to `completed`;
- a classified cancellation maps to `cancelled`;
- other incomplete outcomes map to `failed`;
- foreground progress and the public `SubagentLifecycleEvent` use that same
  state;
- the background record stores `status="cancelled"` and
  `incomplete_reason=None`, rather than encoding cancellation as a failure
  subtype; and
- a running cancellation retains produced result text and counters, while a
  task cancelled before it starts naturally has neither.

The implementation also removes harness-authored cancellation markers such as
`[Cancelled: <reason>]` and `[Interrupted by user]` from the content presented
as a child's partial result. Genuine model output produced before cancellation
can remain; the runtime's own notice cannot be misattributed to the model.
Committed tests cover the shared state mapping, foreground events, background
records, retained work, and equality between pending and running cancellation.
This is source-and-test evidence for the intended contract, not an independent
execution result.

## Assessment

The useful pattern is broader than cancellation: **derive lifecycle truth from
the canonical outcome that crosses the layer boundary, not from a control-flow
signal that an inner layer may consume**. Exception handling remains useful for
truly escaping setup or teardown failures, but it is not a reliable join key
once `chat()`, a worker, or a transport normalizes exceptions into returned
results.

A runtime should keep four fields conceptually separate:

1. **terminal state** — completed, cancelled, failed, or another explicit
   lifecycle value;
2. **failure detail** — meaningful only when the terminal state is failure;
3. **work so far** — model- or tool-produced output worth retaining even when
   the run did not complete; and
4. **harness notices** — runtime-authored explanation that must not be presented
   as agent output.

This separation prevents three downstream errors at once: user-requested stops
inflating failure metrics, partial work disappearing because the run did not
complete, and control-plane text being attributed to the model. It also makes
host integrations simpler: consumers branch on the typed phase rather than
parsing an error string such as `incomplete:cancelled`.

## Compatibility and limitations

Agentao documents this as a host-contract change: running cancellation now emits
`phase="cancelled"` with no `error_type`. Consumers that previously parsed
`incomplete:cancelled` from a failed event must migrate to the phase. Existing
on-disk records are deliberately not rewritten, so old `failed` /
`incomplete:cancelled` rows can coexist with new `cancelled` rows. That is an
important compatibility boundary: correcting future semantics does not prove
historical telemetry has been normalized.

The repository had 303 stars at observation time and exposes substantial source
and tests, but this review establishes only the checked implementation shape at
the pinned commit. It does not establish test-suite passage, workload-scale race
freedom, adoption, or compatibility of every external host.

## Disposition

**New knowledge.** The source adds a concrete, implemented failure mode and a
reusable runtime rule: terminal state should be projected from one canonical
outcome, while failure detail, retained work, and harness-authored notices remain
orthogonal.

## Primary references

- [Pinned repair commit and rationale](https://github.com/jin-bo/agentao/commit/4d90377ca67ef1fe960de8b2da3f9ed6cea91f47)
- [Sub-agent wrapper at the inspected revision](https://github.com/jin-bo/agentao/blob/4d90377ca67ef1fe960de8b2da3f9ed6cea91f47/agentao/agents/tools/_wrapper.py)
- [Turn-level cancellation normalization](https://github.com/jin-bo/agentao/blob/4d90377ca67ef1fe960de8b2da3f9ed6cea91f47/agentao/runtime/turn.py)
- [Cancellation terminal-state regression tests](https://github.com/jin-bo/agentao/blob/4d90377ca67ef1fe960de8b2da3f9ed6cea91f47/tests/test_subagent_cancelled_terminal_state.py)
