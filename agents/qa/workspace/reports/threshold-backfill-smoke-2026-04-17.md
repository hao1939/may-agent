# Threshold backfill smoke test (2026-04-17)

## Scope
Requested: sample **10 recent heartbeat sessions** started after `endedAt=1776442854826` and check whether the **metrics injection block shows ⚠️** on at least one health metric.

## Result
**BLOCKED (data not present in sampled sources).** I could not find the injected “metrics” block text in either:
- `.state/sessions/history/<session>/session.jsonl` inputs, or
- `.state/may.db` `sessions.task` field

So I can’t truthfully count “⚠️ present” vs “⚠️ absent” from stored artifacts.

## Evidence
### 1) `.state/may.db` does not store the injected metrics block in `sessions.task`
I queried the 10 most recent QA heartbeat sessions and checked whether the stored `sessions.task` contains `Injected: metrics` / `⚠️`.

Finding: **all sampled sessions have `hasMetrics=false` and `hasWarn=false`** because the stored task text is just the base heartbeat prompt without injections.

(Collected via a node + better-sqlite3 query.)

### 2) `.state/sessions/history/*/session.jsonl` also lacks the injected metrics block
I scanned the last 60 session histories for an `input` record containing `Injected: metrics` and found **0** matches.

This suggests the injection content may not be persisted into session history (or is stored in another file/key).

## Next steps (recommended)
1. Identify where the final composed task message (after cron injections) is persisted:
   - If it should be in `sessions.task`, update persistence to store the composed message (or store a pointer/hash).
   - If it is stored elsewhere, document that location and update this smoke test accordingly.
2. Once the correct storage location is found, re-run the sampling and record counts.
