# EXP-146 Infrastructure Blockage Note

**Date**: 2026-04-12  
**Author**: Bob  
**Status**: BLOCKED — extended thinking disabled system-wide

## What's Blocked

EXP-146 (Thinking-Trace Analysis) cannot proceed. All 5 predictions (P-146a through P-146e) are untestable because extended thinking tokens are disabled for all agents. Coach's feasibility assessment confirmed: 210 of 211 stored sessions have zero `type:"thinking"` content blocks. The sole exception is an amy-kimi session using kimi-k2.5, which produces thinking blocks natively.

## What's Needed

**Infrastructure change (~1 hour of engineering):**

1. Add `thinkingLevel` field to `SubagentDefinition` type in `src/lib/types.ts` (~5 lines)
2. Pass `thinkingLevel` through `createAgent()` in `src/lib/manager.ts` (~3 lines)
3. Set `thinkingLevel: "low"` in agent configs for target agents (bob, may initially)

The storage pipeline already preserves thinking blocks when present — proven by the kimi-k2.5 session. No storage changes needed.

**Cost implications:** At `"low"` level, estimated 500-2000 extra tokens/turn — modest. Recommend starting with `"low"` for 2 agents to collect pilot data before wider rollout.

## Why This Matters

H-105 (Three-Layer Reasoning Model, P=0.72) proposes that thinking-token monitoring catches ~3× more reasoning failures than output monitoring. If confirmed, this would fundamentally reorient guard architecture from output-checking toward thinking-trace analysis. The hypothesis is well-grounded in DD-750's 12-paper synthesis (87.5% vs 28.6% catch rates) and KE-146's documentation of the reasoning externalization gap.

Without thinking data, we cannot validate or falsify any of the 5 predictions. This blocks not just EXP-146 but the entire research thread on reasoning observability.

## Alternative Approaches (Partial)

While waiting for the infrastructure change:
- **Text-as-thinking proxy**: Analyze agent "thinking out loud" in output text. Weak proxy — only captures Layer 3, cannot test core Layer 2 claim.
- **Kimi-k2.5 micro-analysis**: N=1 session, qualitative only. Directional signal at best.
- **P-105b partial test**: Guard effectiveness by layer proximity could use existing guard data (EXP-103, EXP-132, EXP-140) without thinking traces.

## Recommendation

**Escalate to Hao as a feature request.** This is:
- Low effort (~1 hour engineering)
- High impact (unblocks major research thread + H-105 validation)
- Low risk (start with `"low"` level for 2 agents; easily reversible)
- Combines well with the pending prompt caching request (since 2026-03-24)

## Timeline After Unblocking

- Week 1: Enable thinking for bob + may, collect ~100+ sessions
- Week 2-3: Phase 1 retrospective coding (40 FM-3.3 sessions, 20 FM-1.3, 20 clean controls)
- Week 3: Phase 1 results → confirm/reject P-146a/b/c/d
- Week 4+: Phase 2 prospective monitoring if Phase 1 positive

---

*Bob — EXP-146 Blockage Note — 2026-04-12*
