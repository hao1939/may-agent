# KE-1244: telegram-notifications.md drift re-verified 9 days later — 1538/1538 rows still wrong shape, status header still "shipped"

**Date:** 2026-05-12 (~06:25Z heartbeat)
**Author:** arc
**Confidence:** High — direct DB inspection on a 30-day window of `notification_messages`.
**Connects:** KE-576 (original 2026-05-03 finding), the proposal at `agents/arc/workspace/proposals/2026-05-03-telegram-notifications-md-runtime-reality-appendix.md`, the 2026-05-12 standing-orders/common-sense drift (same pattern: doc says X, code does Y, fix proposal sat unqueued for 9 days).

## TL;DR

The drift KE-576 documented on 2026-05-03 still exists on 2026-05-12. The design doc still declared `**Status**: shipped` until this heartbeat. The proposal that would resolve it (Option A: implement payload; Option B: change doc to envelope-only; Option C: roll back regression metric claim) was never appended to `shared/work-queue.md`, so it never reached human review — identical mechanism to the ORDER-003 / common-sense `implement-and-review` proposal arc just re-queued on 2026-05-12.

## Re-verification numbers (30-day window, 1538 rows)

| Field promised in doc | Doc claim | Runtime (2026-05-12) |
|---|---|---|
| `data.subject` | every msg has it | 0 / 1538 |
| `data.background` | every msg has it | 0 / 1538 |
| `data.state` | every msg has it | 0 / 1538 |
| `data.sentAt` | every msg has it | 0 / 1538 |
| `project_id` set when about project | set | 36 / 1538 (2.3%) |
| `telegram.reply-actionable-rate` metric registered | yes | not present in `metrics` |

`data` actual shape is `{text}` or `{summary, text}` — same as KE-576 found, broader denominator now (1538 vs 689) because the 9-day window stretched.

## Why this kept sitting

1. **Proposal never queued.** `grep telegram shared/work-queue.md` returns nothing. The doc-drift proposals from 2026-05-03 (`*-runtime-reality-appendix.md` series) appear to have shared this failure mode — see the parallel ORDER-003 case re-queued 2026-05-12.
2. **No metric watches the regression.** The doc set its own falsifier (`telegram.reply-actionable-rate`) but it's unregistered, so the system has no signal that the gap persists.
3. **Status header lied.** `**Status**: shipped` makes the doc look closed-out in a directory listing. Heartbeat audits that skim status headers will skip it.

## Action this session

- Edited the design header to `Status: partial — envelope shipped, payload + enrichment did not` with an inline drift note pointing at this KE and the existing proposal. (In-lane: `design/` is arc's edit lane.)
- Appended the proposal to `shared/work-queue.md` under "Proposed (needs review)" so the Option A/B/C decision can actually surface.

## Falsifier

If on the next heartbeat after the proposal lands an Option A merge, this query returns nonzero:
```sql
SELECT COUNT(*) FROM notification_messages
WHERE sent_at > strftime('%s','now')*1000 - 86400000
  AND json_extract(data,'$.subject') IS NOT NULL;
```
then payload landed and this KE should be re-closed with the cutover commit. Currently 0.

## Pattern (cross-link)

Two doc-drift fixes this 2026-05-12 heartbeat day, same root cause: arc files a proposal in `arc/workspace/proposals/` but step 2 of the heartbeat's own "Proposal Submission" subroutine — append a line to `shared/work-queue.md` — was skipped at the time. The proposal becomes invisible. KE-1244 + the re-queued ORDER-003 line are the existence proof that a proposal not on the work queue is the same as a proposal never written.
