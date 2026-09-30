<ai_context>
This finding examines how MulmoTerminal derives human-attention state for parallel coding-agent sessions. Scout inspected one pinned repository revision statically, including the state reducer, Claude event mapping, Codex rollout and permission adapters, persistence transform, documentation, and repository-authored tests in the tree; Scout did not install or run the project or test it against live agent CLIs.
</ai_context>

# Agent attention is a provider-specific observation, not a terminal state

**Date:** 2026-09-30  
**Repo:** <https://github.com/receptron/mulmoterminal>  
**Pinned revision inspected:** [`2c5a75de880170ac4d4cade88ac7c9ccfb1ea078`](https://github.com/receptron/mulmoterminal/tree/2c5a75de880170ac4d4cade88ac7c9ccfb1ea078)  
**Disposition:** New knowledge

## Question

What must a multi-agent console observe to distinguish an agent that is working, blocked on human input, finished with unread output, or merely idle?

## Finding

MulmoTerminal's pinned source shows that **“needs attention” cannot be inferred reliably from an open PTY or terminal silence.** The UI projects four states—working, blocked, done, and idle—but the evidence comes from provider-specific channels. Claude activity is mapped from lifecycle hooks. Codex turn boundaries are reconstructed by tailing its rollout file, while an optional `PermissionRequest` hook supplies the blocked signal. The common reducer then turns those observations into shared `working` and `waiting` flags plus the event that caused them.

This separation matters because observation coverage is conditional. At the inspected revision, declining Codex's hook trust prompt preserves start/finish tracking from the rollout but loses the permission-blocked signal. On Windows, or for a seed-prompt launch, MulmoTerminal does not register that Codex permission hook. A dashboard can therefore show reliable turn activity while lacking reliable blocked-on-approval detection. “No attention flag” is not evidence that no human action is needed unless the relevant adapter and signal path are known to be active.

## What the pinned source shows

### 1. The normalized state still preserves why attention was raised

`src/components/attentionStatus.ts` maps `waiting + Notification` to `blocked`, any other `waiting` state to `done`, `working` to `working`, and everything else to `idle`. The fallback deliberately prefers `done` over claiming an unknown session is stuck. This is a useful conservative presentation rule, but it also means the normalized flag alone is insufficient: the event provenance is required to distinguish a blocked turn from unread completion.

The common hook reducer in `server/session/activity-hook.ts` treats prompt and tool events as working; `Stop` clears working and, when the pane is not actively viewed, raises waiting; actionable `Notification` events raise waiting without ending the turn. An explicit denylist suppresses informational notifications such as subagent completion and authentication success. Unknown notification types remain actionable because missing a genuinely blocked session is judged worse than an extra alert.

### 2. Codex needs two observation channels

`server/agents/codex-activity.ts` parses appended JSONL rollout records. `task_started` marks a turn start, while both `task_complete` and `turn_aborted` mark completion; without the abort case, the working indicator could remain stuck forever after interruption. This channel does not reveal an approval dialog because the rollout writes nothing while that dialog is open.

The separate Codex `PermissionRequest` hook translates a shown approval dialog into the same notification shape used by Claude. Its source comments record the boundary: the hook requires user trust, is not registered on Windows, and is disabled for seed-prompt launches because the one-time review dialog can consume the unattended prompt. Declining hook trust therefore degrades blocked detection without disabling rollout-derived working and finished states.

### 3. Attention depends on whether the user is already looking

The activity reducer suppresses the local attention flag for an actively viewed pane: completed or blocked work among background siblings should surface, while the pane already in focus should not beep as if unseen. Phone push is intentionally different and can fire even for the active pane, because the phone is assumed to be elsewhere. This makes visibility context part of the attention projection, not part of the underlying agent lifecycle.

A reusable design should therefore retain at least three layers: observed provider event, normalized lifecycle state, and delivery/view context. Collapsing them into one status makes it impossible to explain whether silence means idle work, missing instrumentation, already-viewed output, or a suppressed notification route.

### 4. Restart persistence has a stated stale-state boundary

`server/session/activity-state.ts` persists both working and waiting sessions and merges only the session IDs owned by the current server instance, preserving foreign-instance entries in the shared state file. Restored working state is expected to self-correct on the next stop hook. The source explicitly names the exception: if the turn finishes during the restart window and its stop event is lost, the stale working state remains until the user's next turn.

Persistence therefore preserves the last observation; it does not prove that the observed condition is still current. Restored status should carry freshness or adapter-health context if operators might treat it as an authoritative liveness fact.

## Reusable implications

1. **Publish observation coverage with status.** Report which provider adapter and event channels are active; do not render missing instrumentation as healthy idleness.
2. **Keep event provenance.** `waiting` is not enough to distinguish blocked input from unread completion.
3. **Model interruption as a turn boundary.** An aborted turn must clear working state even when no normal completion record arrives.
4. **Separate lifecycle from attention delivery.** Whether a pane is focused, a sound is suppressed, or a phone push is enabled should not rewrite the underlying turn fact.
5. **Treat restored activity as a cached observation.** Restart durability needs freshness and correction semantics, especially when a completion event can be lost during the restart window.
6. **Prefer explicit degraded states.** If a permission hook is declined or unsupported, expose “blocked detection unavailable” rather than silently preserving only the signals that still work.

## Evidence strength and limitations

- Scout inspected the repository statically at the pinned revision. It did not install MulmoTerminal, execute its test suite, start a PTY, or reproduce hooks and rollout records with live Claude Code or Codex versions.
- The recursive Git tree response reported `truncated: false` and included dedicated unit tests for the hook mapping, Codex activity parsing, attention status, persistence, and notification paths. Their presence is evidence of authored test intent, not evidence that the suite passes at this revision.
- Several source comments describe behavior measured against particular CLI versions, including Codex 0.156.1. Provider file formats and hook semantics can change; Scout did not independently reproduce those measurements.
- The README's supported-provider and product claims were not treated as proof that every provider has equivalent observation fidelity.
- The repository had more than 200 GitHub stars at discovery, but popularity does not establish correctness, reliability, or safe multi-agent operation.

## Sources inspected

- Discovery query (Search API returned `incomplete_results: false`): <https://api.github.com/search/repositories?q=agentic+in%3Aname%2Cdescription+stars%3A%3E%3D50&sort=updated&order=desc&per_page=30>
- Latest-commit endpoint used to pin inspection: <https://api.github.com/repos/receptron/mulmoterminal/commits?per_page=1>
- [Pinned repository tree](https://github.com/receptron/mulmoterminal/tree/2c5a75de880170ac4d4cade88ac7c9ccfb1ea078)
- [README](https://github.com/receptron/mulmoterminal/blob/2c5a75de880170ac4d4cade88ac7c9ccfb1ea078/README.md)
- [Shared activity-hook reducer](https://github.com/receptron/mulmoterminal/blob/2c5a75de880170ac4d4cade88ac7c9ccfb1ea078/server/session/activity-hook.ts)
- [Codex rollout boundary parser](https://github.com/receptron/mulmoterminal/blob/2c5a75de880170ac4d4cade88ac7c9ccfb1ea078/server/agents/codex-activity.ts)
- [Codex permission-hook adapter](https://github.com/receptron/mulmoterminal/blob/2c5a75de880170ac4d4cade88ac7c9ccfb1ea078/server/agents/codex-hook.ts)
- [Attention-state projection](https://github.com/receptron/mulmoterminal/blob/2c5a75de880170ac4d4cade88ac7c9ccfb1ea078/src/components/attentionStatus.ts)
- [Restart-persisted activity transform](https://github.com/receptron/mulmoterminal/blob/2c5a75de880170ac4d4cade88ac7c9ccfb1ea078/server/session/activity-state.ts)
- [Mobile notification documentation](https://github.com/receptron/mulmoterminal/blob/2c5a75de880170ac4d4cade88ac7c9ccfb1ea078/docs/guide/en/notifications.md)
