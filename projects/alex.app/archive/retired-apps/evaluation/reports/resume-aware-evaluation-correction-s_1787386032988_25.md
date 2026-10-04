# Resume-aware evaluation correction receipt

Session: `s_1787386032988_25`
Correction identity: `complete-terminal-lifecycle-v1`
Date: 2026-08-22

## Authoritative lifecycle

- Event `5933357` is the first `session.end`: source `app-task-owner`, status/outcome `interrupted`, error `No agent observation for 300000ms`.
- Event `5933370` is the later terminal event for the same session: source `runtime:auto-resume`, status/outcome `done`, with a successful structured `finishParams.result`.
- `/app/.state/sessions/s_1787386032988_25/session.jsonl` contains the same-session `[auto-resume]` continuation and successful final `finish` call.
- `/app/.state/sessions/s_1787386032988_25/result.json` is terminal `done` and contains `finishParams.status=success`, `result.state=waiting`, evidence, and one bounded child action.

The auto-resume terminal result is therefore authoritative over the earlier watchdog interruption.

## Inaccurate projection and correction

- Event `5933377` recorded the inaccurate evaluation (`quality=0.32`, `needs_improvement`, `overall.resultDelivered=false`) from the earlier interrupted attempt.
- Event `5933390` projected that evaluation into generated `aks-explorer` feedback, including the false `INCOMPLETE_OUTPUT` issue.
- Supported correction workflow event `5933649` superseded the durable evaluation for the exact session with `quality=0.88`, `verdict=good`, and `overall.resultDelivered=true`; its task receipt is event `5933652` and evaluator execution is `s_1787387387125_4`.
- Feedback projection receipt event `5933680` updated `generated/agent-feedback/aks-explorer.md`. Read-back shows the false `INCOMPLETE_OUTPUT` finding is absent and the file reflects the corrected good evaluation.

## Repair and regression verification

The repair:

1. Defers the first watchdog interruption while same-session auto-resume can establish the authoritative terminal event.
2. Evaluates a terminal auto-resume event, including a genuinely terminal interrupted auto-resume attempt.
3. Adds an explicit, stable correction task identity that cannot reuse the inaccurate existing evaluation.
4. Records projection ordering state so replay of an older evaluation cannot recreate superseded feedback.

`bun run check` passed after the repair: syntax build, TypeScript, Prettier, and 84 tests (0 failures, 299 expectations). Focused regressions cover interrupted-then-done admission, terminal interrupted admission, explicit supersession, and stale feedback replay after correction.

## Replay and delivery idempotency

A materially equivalent replay used the same correction identity in event `5933657`.

Read-only post-replay verification found:

- `0` additional reconciliations for task `runtime/session-aftermath-repair/s_1787386032988_25/complete-terminal-lifecycle-v1`;
- `0` additional `evaluation.recorded` events for the session;
- `0` correlated `project.owner.requested`, `evaluation.human_decision.requested`, `message.created`, or `notification.sent` events.

Across the complete session correction lineage, the only evaluation facts are the original inaccurate event `5933377` and its supported superseding correction event `5933649`. No human decision was required and no human notification was emitted by the correction workflow.
