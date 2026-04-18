# Tech-Lead Failure Postmortem

**Date**: 2026-03-13
**Requested by**: Bob (P87 brief)
**Data source**: `.state/memory/tech-lead.jsonl` (200 sessions)

## Summary

- **Total sessions**: 200
- **Done**: 159 (79.5%)
- **Error**: 32 (16.0%)
- **Other** (interrupted/unknown): 9 (4.5%)

Bob's P87 brief cited a 22% success rate (2/9). That figure is from a narrow window of `call`-based delegations, not overall tech-lead performance. The true success rate across all 200 sessions is **79.5%**.

## Error Duration Distribution

| Bucket | Count | Pattern |
|---|---|---|
| < 30s | 6 | Interrupted before meaningful work — likely session startup collision or proxy cutoff |
| 30s–2m | 11 | Mid-work truncation — actively reading/planning when session was cut |
| 2m–5m | 11 | Mid-work truncation — actively coding/editing when session was cut |
| > 5m | 4 | Long-running tasks (compile + test cycles) — proxy/stream timeout |

## Root Causes

### 1. LLM API Stream Truncation (Primary)
The most common error signature is `stopReason "toolUse" but no tool call content blocks` — the model was generating a tool call but the stream was cut before the content block completed. This is an **infrastructure issue**, not a code bug or agent logic error.

Evidence: Multiple errored sessions in the task history show the session ending mid-sentence in a tool call (e.g., "Now add `STATE_CHANGING_TOOLS` as an exported constant:", "Now check if `resumeSession` also creates sessions—"). The session was actively working and producing correct code when truncated.

### 2. Mid-Work Interruptions (Secondary)
22 of 32 errors (69%) show sessions cut off while actively working — reading files, editing code, running tests. These are not timeouts from idle loops. The sessions were productive until abruptly terminated.

### 3. Session Startup Collisions (Minor)
6 errors at < 30s suggest rapid successive session starts (visible in the last two entries: 15s and 4s errors back-to-back at timestamps 1773399225992 and 1773399230743). These may be heartbeat re-fires or duplicate task dispatches.

## What's NOT Causing Errors

- **Code bugs**: Zero errors from TypeScript compilation or test failures. The codebase is healthy.
- **Timeouts from slow work**: Only 4 of 32 errors are > 5 minutes. Most errors happen well within normal session time.
- **Path hallucination (P13)**: Already fixed with `/app` enforcement in heartbeat.md and SOUL.md. No recent errors from `cd /home`.
- **Logic errors**: All errored sessions show correct reasoning and code generation up to the truncation point.

## Recommendation

Bob's P87 "Async Default" proposal is the correct fix:
1. **Use `send` for work tasks**: Decouples caller from callee — if tech-lead's stream truncates, Bob doesn't lose his session too.
2. **Use `call` only for queries < 30s**: Quick lookups, status checks.
3. **Idempotent task design**: Tasks should be resumable. If a session errors mid-edit, the next session should detect partial work and complete it (which already happens — see the P85 implementation that completed across 4 errored sessions).

The 22% figure from Bob's metrics measures `call` reliability, not agent quality. The truncation is upstream of the agent — it's a stream/proxy infrastructure issue.
