---
title: "Exempt evaluator from session-transcript access guards"
date: 2026-06-18
author: arc
status: proposed
priority: P2
related: [KE-2030, KE-2021, KE-2007]
---

# Proposal: Exempt Evaluator from Session-Transcript Access Guards

## Problem

Three guards — `SESSION_BASH_CAT`, `SESSION_BASH_GREP`, and `SESSION_READ` — fire when
any agent accesses `.state/sessions/*/session.jsonl` files. These guards exist to prevent
agents from wastefully dumping large transcript files into their context window.

However, the **evaluator's core job** is reviewing session transcripts. It is **designed**
to read session.jsonl files. The guards fire 1,346 times per day solely from evaluator
doing its job, accounting for 27% of all guard.triggered events.

This is a false-positive by design: the guard cannot distinguish "evaluator legitimately
reviewing a session" from "aks-explorer wastefully dumping its own transcript."

## Evidence (2026-06-18, 24h window)

| Guard | Evaluator triggers | % of evaluator guards |
|-------|---:|---:|
| SESSION_BASH_CAT | 840 | 56% |
| SESSION_BASH_GREP | 275 | 18% |
| SESSION_READ | 231 | 15% |
| **Total** | **1,346** | **90% of evaluator's 1,501 triggers** |

Without evaluator false-positives, the guard metric would be at **~3,700/day** instead of
5,086 — well below the 5,500 threshold with 49% headroom instead of 8%.

## Proposed Change

In the guard's `beforeToolCall` handler, check the session's agent before emitting
transcript-access events:

```typescript
// In the SESSION_BASH_CAT / SESSION_BASH_GREP / SESSION_READ guard logic:
const sessionAgent = ctx.session?.agent ?? json_extract(ctx.data, '$.agent');

// Evaluator's job IS reading transcripts — don't warn for it
if (sessionAgent === 'evaluator') return; // skip guard emission
```

Alternatively, add an `exemptAgents: ['evaluator']` config field to these guard
definitions so the exemption is declarative rather than hard-coded.

## Expected Impact

1. Guard triggered count drops from ~5086 → ~3740 (26% reduction)
2. Guard metric headroom increases from 8% to 32%
3. No more threshold calibrations needed for evaluator-driven growth
4. Evaluator sessions become slightly cheaper (no guard event + signal injection overhead)

## Risks

- If evaluator develops a *wasteful* transcript access pattern (e.g., reading the same
  session 10x), the guard won't catch it. Mitigated by: evaluator already has read-dedup
  guard active, and evaluator quality metrics (meaningful-review-rate) would surface this.
- Exemption scope could expand ("why not exempt scout too?") — keep it narrow to evaluator
  only, since no other agent has transcript-reading as its primary function.

## Requires

ORDER-010 compliance: guard code lives in shared/guards/ which is an src-level change
requiring Hao's approval.
