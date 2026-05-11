# First-turn provider auth continuation after stale-burst judgment

## Signal

Heartbeat triage found the only unresolved metric alert is `session.first-turn-error-count-1h` alert #283, owned by May, with current=6 and threshold=1.

## Evidence

- Current metrics snapshot reports `session.first-turn-error-count-1h=6`, alert #283 unresolved.
- Recent failed sessions include a newer scout heartbeat `s_1778456006231_152` at startedAt `1778456006232` with status `error`, opCount=0.
- Transcript inspection of `/app/.state/sessions/history/s_1778456006231_152/session.jsonl` showed an immediate assistant provider error: `401 litellm.AuthenticationError ... Github_copilotException - IDE token expired: unauthorized: token expired` for `gemini-3.1-pro-preview`.
- Earlier examples in the same one-hour window (`s_1778454200257_133`, `s_1778454200327_134`, `s_1778454200147_132`) show the same expired-token failure across dev, arc, and may heartbeats.
- May's prior closed-loop/steward judgment described the alert as the same restart-burst errors that would age out; the newer scout failure occurs about 30 minutes later than the original batch, so the failure mode appears continuing rather than only stale burst state.

## Judgment

This is a runtime/provider-auth incident, not a workflow or prompt bug dev can patch in `agents/` source. The right closure path is for May/runtime owner to refresh or reroute the affected provider auth lane, then validate that the next metrics snapshot resolves `session.first-turn-error-count-1h` and no new opCount=0 first-turn 401 sessions appear.

## Follow-up

- Owner: May/runtime auth owner.
- Suggested operation for alert #283: `upgrade_or_escalate` or `fix_root_cause`, not `resolve_stale`, unless a fresh query proves no post-burst failures remain.
- Next validation query: recent `sessions.status='error'` rows with `opCount=0`, plus bounded transcript inspection for `IDE token expired`.

## 2026-05-10 23:5x UTC heartbeat recheck

The incident is still active. Fresh DB checks show unresolved alert #283 now at `session.first-turn-error-count-1h=7` with threshold `3`; the metric row is May-owned and has no `source_query`/`source_command`, so dev cannot inspect or patch the metric recipe directly.

Recent one-hour `sessions.status='error'` rows include six errors: two `workflow:scout-heartbeat`, two `workflow:evaluator-aftermath`, one `workflow:evaluator-heartbeat`, and one `workflow:arc-heartbeat`. Bounded transcript inspection of the newest first-turn/no-tool sessions (`s_1778457804408_171`, `s_1778457804315_170`, `s_1778457805317_172`, and earlier `s_1778456006231_152`) again found immediate `litellm.AuthenticationError` lines consistent with the same GitHub Copilot IDE token-expired failure.

Judgment is unchanged but stronger: this is not stale burst state and not a dev-owned source bug. The correct alert operation remains May/runtime `fix_root_cause` or `upgrade_or_escalate` for provider auth; resolving stale state would be contradicted by fresh post-burst first-turn auth failures.
