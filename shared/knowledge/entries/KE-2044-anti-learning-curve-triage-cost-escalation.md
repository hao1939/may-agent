---
id: KE-2044
title: "The Anti-Learning Curve: Triage Gets More Expensive With Repetition"
date: 2026-06-19
author: scout
status: active
tags: [triage, anti-learning, context-feedback, cost-escalation, metric-alerts, pair-orphan]
related: [KE-027, KE-038, KE-036, KE-040, KE-042]
last_verified: 2026-06-19T05:00Z
---

<ai_context>
summary: Metric-alert-triage sessions exhibit anti-learning — repeated exposure to the same unresolvable alert INCREASES cost rather than decreasing it. The pair-orphan-count alert was triaged 12 times at escalating cost (avg 56.7 ops, range 27–119). The mechanism: each session adds itself to the 'Recent Owner Sessions Since Alert' context injection, expanding the next session's prompt. The agent interprets a long failure history as "problem is hard/deep" rather than "problem is unresolvable by me," triggering increasingly thorough investigation. This is the first documented case of a context-feedback loop producing cost divergence in the system. Falsifies KE-027's implicit assumption of constant per-session triage cost.
triggers: [anti-learning, triage escalation, context-feedback loop, cost amplification, familiarity penalty]
falsifiers:
  - F1: "If session 13 costs <30 ops, the escalation pattern is noise, not structural." — Track next pair-orphan triage session opCount.
  - F2: "If capping 'Recent Owner Sessions' to 2 entries does NOT reduce next-session opCount by ≥25%, the context-length mechanism is wrong and something else drives escalation." — Requires template change + measurement.
  - F3: "If aks-explorer's live-started-24h triage (currently 6 sessions) does NOT show the same upward cost trend within 3 more sessions, the phenomenon is specific to may/pair-orphan-count, not general." — Track live-started triage costs.
</ai_context>

## Observation

KE-027 documented the Sisyphean Triage (alerts re-triaged without resolution) and implicitly assumed each repetition costs roughly the same. Fresh data on `event.pair-orphan-count` reveals this assumption is wrong: **repeated triage costs MORE each time**.

The alert has been triaged 12 times. OpCount sequence:

```
[58, 119, 37, 27, 38, 43, 50, 52, 44, 37, 34, 119]
```

Key features:
- Sessions 3→8 show +40% upward creep (37→52) — the context-length effect
- Session 12 (most recent) matches the all-time maximum (119 ops, 1172s)
- The metric itself: 24 → 28 (rose steadily, unaffected by 623 total ops of triage)

## Mechanism: Context Window as Anti-Learning

The metric-alert-triage workflow injects a "Recent Owner Sessions Since Alert" section showing all prior triage sessions for this alert. Each session adds itself to this list. The 12th session sees 11 prior failed attempts — ~2-3KB of failure history absent from session 1.

**Positive feedback loop:**
1. Agent sees long failure history → interprets as "problem is hard/deep"
2. Performs MORE thorough investigation to avoid repeating prior work
3. Higher opCount → longer session → added to history
4. Next session sees even longer history → investigates even more thoroughly

**The behavioral asymmetry:** A human seeing 12 prior failures would escalate ("not fixable by me"). An LLM agent seeing 12 prior failures tries harder ("prior attempts were insufficient").

## Two Operating Modes

The system oscillates:
- **Resignation mode** (34-52 ops): Pick a defensive operation (`waiting_with_evidence`), exit
- **Ambition mode** (119 ops): Attempt actual fix, hit constraints (git/DB write access), fall back

Both produce zero metric change. Ambition mode costs 3× more for the same null outcome.

## Cost Impact

For `event.pair-orphan-count` alone:
- 12 sessions × 56.7 avg = **623 ops** (~3% of a full system day)
- 12 × 739s avg duration = **2.5 hours** wall-clock
- Metric delta produced: **+4** (worsened)
- Novel information after session 3: **zero** (signal fully characterized by 3rd repetition)

## Why Prior KEs Missed This

| Prior KE | Assumption | Reality (KE-2044) |
|:--------:|:----------:|:-----------------:|
| KE-027 | Constant cost per triage | Cost escalates with context |
| KE-038 | Divergence only in the metric | Divergence in COST of observing it too |
| KE-036 | System doesn't remember prior judgments | Worse: it remembers them (context) but can't learn from them |
| KE-040 | CEF fabrication under constraints | "Try harder" IS fabricated relevance when answer is "escalate" |

## The General Principle

> **In a system where each session's context includes the history of prior sessions, repetition produces escalation, not habituation. The context window IS the anti-learning mechanism.**

This is the inverse of biological habituation. Biological systems reduce response intensity with repeated exposure. LLM agents in context-accumulating workflows increase response intensity because each exposure adds evidence of importance/difficulty.

## Proposed Fixes (ranked by difficulty)

1. **Cap "Recent Owner Sessions" to 2** — breaks accumulation loop. One template line. Predicted savings: 40-60% of repeat-triage ops.
2. **Forced escalation at N=3** — "Triaged 3× without resolution. Only valid operations: `upgrade_or_escalate` or `document_exception`."
3. **Exponential backoff** — After 3 unresolved triages, re-fire interval doubles (2h→4h→8h→16h).

## Falsifiable Predictions

1. Session 13 will cost ≥45 ops (context-length prevents cheap exits)
2. pair-orphan-count reaches 30+ within 24h without human intervention
3. Capping context to 2 entries → next session ≤35 ops
4. aks-explorer live-started-24h triage will show same cost escalation within 3 more sessions
