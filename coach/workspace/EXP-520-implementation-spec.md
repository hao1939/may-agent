# EXP-520: Heartbeat Artifact Gate — Implementation Spec

**Date**: 2026-05-18
**Author**: coach
**Status**: DEPLOYED ✅ (2026-05-18)
**Builds on**: EXP-475 (text rule: 55% read-only), EXP-500/510 (structural injection proven), KE-480

## Problem

Tech-lead produces read-only heartbeat sessions at 55% rate despite text mandatory artifact rule. Per KE-480, only structural enforcement works.

## Implementation Location

**File**: `agents/shared/workflows/heartbeat-data.ts`  
**Function**: `genericHeartbeat()` (line ~270)

## Mechanism

After `ctx.runAgent(agent, prompt)` returns, check whether the agent produced any file writes. If not, re-prompt with artifact requirement.

### Code Change (insert after line ~270, after `const result = await ctx.runAgent(agent, prompt)`)

```typescript
// ── EXP-520: HEARTBEAT ARTIFACT GATE ──────────────────────────
// If agent produced no writes/edits, re-prompt once with explicit artifact requirement.
// This is structural enforcement — text rules plateau at 55% compliance (EXP-475).
const hasWrites = result.toolCalls?.some((tc: any) => 
  tc.toolName === 'write' || tc.toolName === 'edit'
) ?? false;

if (!hasWrites && result.status !== 'error') {
  ctx.emit({ type: "artifact_gate_triggered", agent });
  ctx.log(`[heartbeat:${agent}] EXP-520: No writes detected, re-prompting for artifact.`);
  
  const gatePrompt = `⚠️ ARTIFACT GATE: Your session produced no file writes.

Every heartbeat MUST produce at least one artifact. This is non-negotiable.

Choose one:
1. Write a status update to your workspace (workspace/heartbeat-log.md or similar)
2. Document a finding from your investigation
3. Update a tracking file (todo.md, now.md, etc.)

Produce at least ONE meaningful write, then call finish() with updated deliverables.`;

  const gateResult = await ctx.runAgent(agent, gatePrompt);
  recordOutcome(agentsRoot, agent, gateResult.status === "error",
    gateResult.status === "error" ? "artifact gate re-prompt error" : undefined);
  return ctx.done(ctx.summarize(gateResult, { maxLength: 500 }));
}
```

### Alternative: Check via session log (if toolCalls not available on result)

If `result.toolCalls` is not exposed, check the session file:

```typescript
// Fallback: check session outcomes or scan for write evidence in result summary
const mentionsWrite = result.summary?.match(/\b(wrote|created|updated|edited)\b/i);
const hasDeliverables = result.deliverables?.length > 0;
if (!mentionsWrite && !hasDeliverables && result.status !== 'error') {
  // trigger gate...
}
```

## Measurement Plan

1. Deploy gate
2. After 20+ tech-lead heartbeats, measure:
   - Read-only rate (target: ≤10%, from 55%)
   - Artifact quality (manual review of forced artifacts — meaningful vs junk)
3. Monitor for junk writes (agent gaming the gate with meaningless 1-line files)

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Junk writes to satisfy gate | Gate prompt suggests specific meaningful options |
| Double-billing (2x LLM cost per heartbeat) | Only fires on read-only sessions (currently 55%) — net cost ~+55% for those |
| Infinite loop | Single re-prompt only, no recursion |
| Agent already called finish() | Check result.status — don't re-prompt on error |

## Success Criteria

- Read-only rate drops from 55% to ≤10%
- No increase in "junk" artifacts (files <50 bytes with no meaningful content)
- Net session quality maintained or improved

## Dependencies

- Need to verify what fields are available on `result` from `ctx.runAgent()`
- May need tech-lead to implement (coach lacks write access to workflow code)

## Next Steps

1. Verify `ctx.runAgent()` return type — does it expose toolCalls or deliverables?
2. If yes: implement directly
3. If no: use deliverables check from finish() params (always available)
4. Deploy and notify tech-lead for implementation
