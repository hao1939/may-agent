# Root cause: reconciled `session.end` event 5266969

## Exact lineage

Runtime DB evidence (read-only `query_db`, 2026-08-08) identifies:

- Event `5266631`: accepted `session.start` for evaluator session `s_1786160308144_525`, workflow run `wr_1786160231383_xrqw` (`evaluator-aftermath`), accepted by `event-pair-tracker`.
- Session `s_1786160308144_525`: terminal `interrupted`, 18 operations, ended at `1786160694603`; error: `Task-bound project session was not claimed by project-app recovery during startup`.
- Workflow run `wr_1786160231383_xrqw`: terminal `interrupted`; reason: `Process restarted`.
- Event `5266969`: recovery-produced `session.end` with `{sessionId:"s_1786160308144_525", agent:"evaluator", status:"interrupted", reconciled:true}`. It had no source/owner and aged from pending to `delivery_status='unhandled'` with `no responsible consumer accepted event before timeout`.

## Consumer contract and root cause

Reconciled `session.end` rows are terminal lifecycle facts produced after the real session has already ended. They do not request new owner work and therefore intentionally have no routed consumer. `DbWriter.sweepUnacceptedEvents()` encodes this contract by accepting reconciled terminal `session.end` rows as `accepted_by='terminal-noop'`, `delivery_route='noop'` before the generic unhandled sweep.

The predicate in `src/lib/db-writer.ts` recognized only `status='done'`. The session status contract also has terminal `error` and `interrupted` states. Consequently all observed reconciled interrupted rows bypassed terminal-noop acceptance; a read-only aggregate found 89 unhandled and 7 pending reconciled interrupted `session.end` rows, including event 5266969. This was a classification defect, not a missing evaluator consumer.

## Correction

`isTerminalNoopEvent()` now accepts reconciled `session.end` rows for all terminal session statuses: `done`, `error`, and `interrupted`. It still requires `reconciled:true`, a string `sessionId`, and a string `agent`; unrelated or non-reconciled unaccepted events continue through the genuine unhandled-delivery path.

## Verification

- `bun test src/app/event-delivery.test.ts --filter 'terminal no-ops|marks new unaccepted'`: 47 passed, 0 failed. The fixture now covers `done`, `error`, and the exact `interrupted` class and proves each becomes `accepted / terminal-noop / noop`. The neighboring actionable `reload` fixture remains `unhandled`.
- `bun test ./agents/tech-lead/workflows/ops-health-review.test.ts --timeout 30000` in `may-agent.app`: 13 passed, 0 failed. The observer does not wake on session lifecycle telemetry while still waking for actual unaccepted actionable events and other signal families.
- `bun run check` in `may-agent`: TypeScript completed with exit code 0.

No runtime database row was mutated during this investigation.
