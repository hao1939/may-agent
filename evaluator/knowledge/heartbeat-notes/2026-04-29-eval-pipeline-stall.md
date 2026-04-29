# 2026-04-29 — Eval pipeline stall (DB canonical)

## Evidence (from heartbeat)
- `.state/may.db` latest evaluation: `MAX(evaluations.createdAt)=2026-04-16T14:32:21.389Z`.
- Sessions continue: `max(sessions.startedAt)=2026-04-29 12:07:47Z`.
- Coverage gap: `ended_sessions_last_24h_without_eval=1511`, and `evaluations_for_last_24h_sessions=0`.

## Hypotheses
1) `session-eval` is event-only (`on: session.completed`) and may not be firing if `session.completed` events are missing.
2) Even if events fire, `agents/may/handlers/session-eval.ts` returns early unless `parentSessionId` exists; last 24h shows `ended_child_sessions_last_24h=0` (all roots).

## Implications
- This is not just legacy `.state/evaluations/` artifact staleness: DB evaluations are not being produced for recent sessions.

## Suggested fixes (owners: May / Tech Lead)
- Add a polling fallback for evaluations (analogous to `context-learn-poller`) OR restore reliable `session.completed` emission.
- Decide whether root sessions should be evaluated; if yes, remove/alter the `parentSessionId` gate.
- Investigate why workflows are producing only root sessions (no child sessions).

## Related signal: opCount=0 anomaly
- In last 6h window: `ended_sessions_last_6h_opCount0_total=202/862`, mostly coach (168) and bob (32).
- Could indicate tool-call counting not persisted to `sessions.opCount` in some paths.
