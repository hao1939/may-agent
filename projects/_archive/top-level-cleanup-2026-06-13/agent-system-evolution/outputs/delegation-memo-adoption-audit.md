# Delegation Memo Adoption Audit

**Date**: 2026-05-22  
**Auditor**: may (automated)  
**Convention**: contracts/delegation-memo-convention.md

## Summary

**Adoption rate: 0% (0/10 sessions)**

## Diagnosis

The convention was published during this same project iteration (task `delegation-memo-convention`, session `s_1779366391325_198`). All 10 audited `agents.fork`/`agents.call` sessions predate the convention's creation. Therefore **zero adoption is expected** — the convention didn't exist when these delegations were made.

## Audited Sessions

| # | Session ID | Agent | Task Style | Memo? |
|---|-----------|-------|-----------|-------|
| 1 | s_1779137694875_180 | scout | Heartbeat trigger, no structure | ❌ |
| 2 | s_1779129938446_156 | scout | Heartbeat trigger | ❌ |
| 3 | s_1779109430658_83 | scout | Heartbeat trigger | ❌ |
| 4 | s_1779101927162_58 | scout | Heartbeat trigger | ❌ |
| 5 | s_1779094042355_8 | scout | Heartbeat trigger | ❌ |
| 6 | s_1779046337478_462 | scout | Heartbeat trigger | ❌ |
| 7 | s_1778988850452_164 | scout | Heartbeat trigger | ❌ |
| 8 | s_1778678318230_146 | dev | GOAL + Steps, free-form | ❌ |
| 9 | s_1778672946852_109 | arc | Goals list, free-form | ❌ |
| 10 | s_1778656714888_6 | dev | GOAL + Steps, free-form | ❌ |

## Root Cause Analysis

1. **Convention is brand-new** — created in this iteration, no time for adoption.
2. **Heartbeat forks dominate** — 7/10 delegations are scout heartbeat triggers dispatched by `may` during cron. These are fire-and-forget heartbeat kicks, not task delegations where a memo adds value.
3. **No enforcement mechanism** — the convention is documented but nothing validates or prompts agents to use it at fork/call time.

## Recommendations

Since 0% is explained by timing (convention didn't exist), this is NOT a behavioral failure. The correct next step is:

1. **Wait for post-convention delegations** — re-measure after 5+ new `agents.fork`/`agents.call` sessions are created post-convention.
2. **Exclude heartbeat forks from measurement** — they're infrastructure triggers, not task delegations. Filter to sessions where `task` doesn't start with `[heartbeat]`.
3. **If still <30% after waiting**: inject the convention as a system prompt fragment for the `agents` tool (prompt injection), so agents see the memo template when composing a fork/call.
4. **Convention simplification candidate**: For heartbeat-style kicks, allow a "lightweight memo" that only requires `goal` (e.g., "Run scout heartbeat cycle").

## Verdict

Measurement is premature. Re-run this audit after 48h of post-convention operation with at least 5 non-heartbeat fork/call sessions.
