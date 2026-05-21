# session-aftermath-scan timeout recovery check

## Signal

Heartbeat handler checks found five `handler.failed` rows in the last 6h, all for `session-aftermath-scan` timing out after 300s. The latest failure was at timestamp `1779375582948` with duration `318052ms`.

## Evidence

- Core metrics stayed healthy: `handler.success-rate=0.9954` (target `0.95`) and `session.error-rate-6h=0.0196` (target `0.1`).
- Direct handler grouping over the last 6h showed `session-aftermath-scan` as the only failing handler (`failures=5`, latest `1779375582948`).
- Lifecycle query after that latest failure showed repeated successful starts/completions for the same handler, including completions at `1779381881514` (`50ms`) and `1779382329447` (`47ms`).

## Judgment

No runtime patch is warranted in this heartbeat: the timeout pattern recovered without a code change, current top-line handler health is above target, and the fallback handler has completed repeatedly since the latest timeout. The signal is not dismissed as noise; it is a monitor-only recovery judgment.

## Resume trigger

Reopen investigation if a fresh `session-aftermath-scan` timeout appears after `1779382329447`, or if three consecutive successful runs exceed `240000ms`, indicating the fallback is again approaching the 300s handler limit.
