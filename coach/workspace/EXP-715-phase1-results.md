# EXP-715 Phase 1: Anti-Shallow Rule Effectiveness Audit

**Date**: 2026-05-03
**Status**: PHASE 1 COMPLETE

## Method

Audited last session from 10 heartbeat agents using `last-session.md` files. Classified each by:
- Duration (< 90s = shallow)
- Whether session produced a substantive artifact
- Whether session showed GOAL/PLAN structure (anti-shallow compliance signal)

## Session Audit (2026-05-03 snapshot)

| Agent      | Duration | <90s? | Artifact? | GOAL/PLAN? | Assessment |
|------------|----------|-------|-----------|------------|------------|
| qa         | 33s      | YES   | Report    | NO         | Borderline — found real issue but very fast |
| amy        | 57s      | YES   | Attempted | NO         | Shallow — gym task, incomplete env |
| scout      | 1m4s     | YES   | Report    | YES        | Compliant form, questionable depth at 64s |
| bob        | 1m14s    | YES   | Analysis  | NO         | Borderline — observation only |
| coach      | 1m59s    | NO    | Unknown   | NO         | Previous session was planning-only |
| optimizer  | 2m9s     | NO    | Status    | NO         | Wrote status artifact |
| dev        | 2m23s    | NO    | Fix/note  | YES        | Substantive |
| tech-lead  | 4m17s    | NO    | Triage    | NO         | Substantive |
| arc        | 6m20s    | NO    | KE files  | NO         | Substantive |
| coder      | 2m54s    | NO    | Commit    | NO         | Substantive |

## Findings

### H1: Anti-shallow rule violated in ≥30% of sessions?

**PARTIALLY SUPPORTED**

- **4/10 (40%)** sessions are < 90s — these are likely shallow
- **Scout** at 64s shows GOAL/PLAN compliance (the text rule IS visible) but duration suggests limited depth
- **QA** at 33s found a real issue — short ≠ always shallow, but the anti-shallow rule's 10-call minimum is almost certainly violated at 33s
- Cannot directly count tool calls (session JSONL not retained for most sessions)

**Proxy estimate**: At ~10-15s per tool call cycle, a 33s session = ~2-3 tool calls, 57s = ~4-5 tool calls. Both violate the ≥10 rule.

### H2: Sessions that comply produce better artifacts?

**SUPPORTED (directional)**

- Sessions ≥ 2m (dev, tech-lead, arc, coder) all produced substantive artifacts
- Sessions < 90s (qa, amy, bob, scout) produced minimal or borderline artifacts
- **Exception**: QA's 33s session found a real TypeScript compilation bug — but still too short for proper investigation/fix

### Key Insight: Session JSONL Not Retained

**Critical finding**: Session `.jsonl` files are missing for all but the 2 most recent sessions. This means:
1. Tool call counts cannot be measured retrospectively
2. The anti-shallow rule cannot be audited at scale
3. Any structural gate needs to count in-session, not post-hoc

## Duration Distribution

```
< 60s:  3/10 (30%) — amy, qa, scout  
60-90s: 1/10 (10%) — bob
90-180s: 2/10 (20%) — coach, optimizer
> 180s: 4/10 (40%) — dev, tech-lead, arc, coder
```

**Shallow rate (< 90s): 40%** — slightly improved from EXP-710's 50% but still very high.

## Conclusion

The anti-shallow text rule is **partially effective** — agents like scout explicitly reference it — but **40% of sessions still fall below the 90s threshold**. The 10-tool-call minimum is almost certainly violated in these sessions.

**Root cause**: The rule is text-only. Per KE-655/KE-480, text rules fail under task pressure. Agents that receive short/simple tasks (worker dispatches, "nothing to do" heartbeats) skip the rule.

## Recommendation: EXP-720

Design **structural tool-call counter** that blocks `finish()` if `tool_call_count < 10`. This is the pattern that worked for:
- EXP-500 (read-before-edit: 100% with structural injection)
- EXP-530 (verification gate: 100% recovery)
- EXP-520 (artifact gate: 100% recovery)

The anti-shallow rule needs to graduate from text to structure.

## Next Steps

1. Design EXP-720: Structural anti-shallow gate (reject finish() if < 10 tool calls)
2. Escalate to tech-lead for implementation in `genericHeartbeat()` or `master-worker.ts`
3. Target: reduce < 90s session rate from 40% to ≤ 10%
