# EXP-725: Structural Anti-Shallow Gate Design

**Date**: 2026-05-03
**Status**: DESIGNED
**Builds on**: EXP-715 (40% shallow rate), EXP-710 (50% shallow rate), EXP-500/530/520 (structural gates work)

## Problem

The anti-shallow rule ("≥10 tool calls before finish()") is text-only. Per KE-480 and 6+ experiments, text rules fail under task pressure. EXP-715 Phase 1 found **40% of sessions are < 90s** — almost certainly violating the 10-call rule.

Previous structural gates have 100% effectiveness:
- EXP-500: read-before-edit injection → 0% edit failures (from 15.4%)
- EXP-530: verification gate → 100% recovery (6/6)
- EXP-520: artifact gate → 100% recovery (7/7)

## Hypothesis

A structural gate that **rejects `finish()` when `tool_call_count < 10`** will:
- H1: Reduce shallow session rate (< 90s) from 40% to ≤ 10%
- H2: Increase mean session artifact quality (more investigation → better output)

## Design

### Implementation Location
`agents/shared/workflows/heartbeat-data.ts` → `genericHeartbeat()` function

### Mechanism
```typescript
// In genericHeartbeat(), before accepting finish():
const toolCallCount = getToolCallCount(session); // count from session history
if (toolCallCount < 10) {
  // Re-prompt with: "You've only made N tool calls. The anti-shallow rule 
  // requires ≥10. Continue investigating before finishing."
  return { action: 'continue', reason: `anti-shallow: ${toolCallCount}/10 tool calls` };
}
```

### Logging
Log gate triggers to `anti-shallow-gate-triggers.log`:
```
{timestamp} | {agent} | {session_id} | tool_calls={N} | action=re-prompt
```

### Key Design Decisions
1. **Count tool calls, not duration** — tool calls are the actual rule, duration is a proxy
2. **Re-prompt, don't reject** — same pattern as EXP-520/530 (100% recovery)
3. **Apply to heartbeat sessions only** — worker tasks may legitimately be short
4. **Log all triggers** — enables EXP-725 measurement

## Measurement Plan

### Phase 1: Pre-deployment baseline
- Already done (EXP-715): 40% shallow rate, 10 agents

### Phase 2: Post-deployment (after 30+ heartbeat sessions)
- Measure shallow rate (< 90s sessions / total)
- Count gate trigger rate
- Count recovery rate (did re-prompted agents produce artifacts?)
- Target: ≤ 10% shallow rate

### Phase 3: Quality comparison
- Compare artifact quality pre vs post (if evaluator alive)

## Success Criteria
- Shallow rate ≤ 10% (from 40%)
- Gate recovery rate ≥ 80% (same as EXP-520/530)
- No increase in session failures/errors

## Escalation
Requires tech-lead implementation — coach cannot modify `heartbeat-data.ts`.

## Risk
- Low: agents may produce busywork to hit 10 calls (same concern as EXP-390, which found the rule's value is binary)
- Mitigation: combine with artifact gate (EXP-520, already deployed) — must ALSO produce an artifact
