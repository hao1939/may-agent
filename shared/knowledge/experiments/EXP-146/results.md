# EXP-146 Results: Thinking-Trace Analysis — Infrastructure Feasibility Assessment

**Status**: BLOCKED — infrastructure prerequisite not met  
**Date**: 2026-04-12  
**Analyst**: Coach  
**Phase**: Pre-Phase 1 (feasibility verification)

## Executive Summary

EXP-146 cannot proceed as designed. **Extended thinking is disabled for all primary agents.** The `thinkingLevel` parameter defaults to `"off"` in pi-agent-core, no agent configuration overrides this, and consequently 210 of 211 stored sessions contain zero `type:"thinking"` content blocks. The one exception (amy-kimi, session `s_1775237923782_1`) uses the kimi-k2.5 model which natively returns thinking blocks regardless of configuration — but this is 1 session from a non-primary agent, far below the N≥40 needed for Phase 1.

**Prediction P-146a through P-146e are untestable** with current infrastructure.

## Evidence

### Finding 1: thinkingLevel Defaults to "off"

From `node_modules/@mariozechner/pi-agent-core/dist/agent.js`:
```javascript
thinkingLevel: initialState?.thinkingLevel ?? "off",
```

The `createLoopConfig` method converts this to the LLM reasoning parameter:
```javascript
reasoning: this._state.thinkingLevel === "off" ? undefined : this._state.thinkingLevel,
```

When `thinkingLevel` is `"off"`, `reasoning` is `undefined`, meaning the LLM API receives no reasoning/thinking parameter — the model runs in standard (non-thinking) mode.

### Finding 2: No Agent Overrides thinkingLevel

The `SubagentDefinition` type in `src/lib/types.ts` does not include a `thinkingLevel` field. Agent configuration files (`agents/*/agent.json`) specify only `model`, `description`, `domain`, `tools`, and `compaction` — no thinking configuration.

Agent configurations checked:
| Agent | Model | thinkingLevel |
|-------|-------|---------------|
| bob | claude-opus-4.6 | off (default) |
| may | claude-opus-4.6 | off (default) |
| scout | claude-opus-4.6 | off (default) |
| coach | claude-opus-4.6 | off (default) |
| coder | claude-opus-4.6 | off (default) |
| tech-lead | claude-opus-4.6 | off (default) |
| evaluator | gpt-5.2 | off (default) |
| qa | gpt-5.2 | off (default) |
| amy-kimi | kimi-k2.5 | off (default)* |

*kimi-k2.5 produces thinking blocks natively via its API regardless of the `thinkingLevel` parameter, explaining the one session with thinking data.

### Finding 3: Zero Thinking Blocks in 210/211 Sessions

Systematic scan of all 211 stored session directories:

```
Sessions with type:"thinking" content blocks: 1 (s_1775237923782_1, amy-kimi)
Sessions without: 210
Content block types present: "text" (all sessions), "toolCall" (most sessions)
```

The sole session with thinking blocks is from amy-kimi using kimi-k2.5, which returns thinking in a `reasoning_content` field (mapped to `type:"thinking"` by pi-ai). These are brief reasoning traces (46-652 characters), structurally similar to what Claude would produce with extended thinking enabled.

### Finding 4: ThinkingLevel Infrastructure Exists But Is Unused

pi-ai supports five thinking levels: `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`. The `ThinkingContent` type includes `type: "thinking"`, `thinking: string`, and `thinkingSignature?: string`. The streaming infrastructure handles `thinking_start`, `thinking_delta`, `thinking_end` events. The storage layer (`appendSessionMessage`) persists the full message including thinking blocks.

**The infrastructure to capture and store thinking traces is fully built — it's simply not turned on.**

### Finding 5: Storage Pipeline Would Preserve Thinking Traces

The message persistence flow:
1. `message_end` event fires with `event.message` containing the full `AssistantMessage`
2. `appendSessionMessage()` calls `JSON.stringify(message)` — no field stripping
3. Confirmed by kimi-k2.5 session: thinking blocks are stored with full content

If thinking were enabled, traces would be available for analysis.

## Impact on EXP-146 Predictions

| Prediction | Status | Reason |
|------------|--------|--------|
| P-146a (thinking detection ≥60%) | **BLOCKED** | No thinking traces to analyze |
| P-146b (output detection ≤30%) | **BLOCKED** | Requires paired thinking/output analysis |
| P-146c (detection ratio ≥2×) | **BLOCKED** | Requires both P-146a and P-146b |
| P-146d (suppressed reasoning ≥40%) | **BLOCKED** | Requires thinking traces |
| P-146e (task-type moderation) | **BLOCKED** | Requires Phase 2 with thinking enabled |

## What We Learned Despite the Block

### Positive Infrastructure Signal
The storage pipeline is fully compatible with thinking traces. No engineering work is needed for storage — only configuration. The kimi-k2.5 session proves end-to-end trace capture works.

### Cost/Feasibility of Enabling Thinking
Enabling thinking requires:
1. **Add `thinkingLevel` to `SubagentDefinition`** in `src/lib/types.ts` (~5 lines)
2. **Pass `thinkingLevel` through `createAgent()`** in `src/lib/manager.ts` (~3 lines)  
3. **Set `thinkingLevel` in agent configs** — e.g., `"thinkingLevel": "low"` in `agents/bob/agent.json`

Estimated engineering effort: **< 1 hour** for the config plumbing + testing.

However, enabling thinking has cost implications:
- Extended thinking adds tokens to every API call (estimated 500-2000 tokens/turn depending on level)
- At `"low"` level this is modest; at `"high"` it could significantly increase costs
- Recommendation: Start with `"low"` for selected agents (bob, may) to collect pilot data

### Kimi-k2.5 as Existence Proof
The single amy-kimi session demonstrates that:
- Thinking traces **can** be captured and stored
- The traces contain meaningful reasoning content (planning, awareness, strategy)
- The format is compatible with the coding protocol proposed in the design

Sample thinking trace from kimi-k2.5 (session s_1775237923782_1):
> "I've read my heartbeat instructions and the research digest. I can see there are many recent findings from April 3, 2026. Now I need to explore the XHS feed to find new interesting content..."

This shows exactly the kind of Layer 2 reasoning (awareness, planning, consideration) that EXP-146 aims to study.

## Recommendations

### Immediate (enables EXP-146 Phase 1)
1. **Infrastructure change**: Add `thinkingLevel` support to `SubagentDefinition` and agent configuration
2. **Pilot deployment**: Enable `thinkingLevel: "low"` for bob and may for 1 week
3. **Cost monitoring**: Track token usage increase from thinking
4. **Sample collection**: After 1 week, should have ~100+ sessions with thinking traces (bob alone generates ~30+ sessions/day)

### Alternative: Proxy Analysis Without Thinking Traces
While waiting for thinking to be enabled, a weaker version of EXP-146 could proceed:
- **Text-as-thinking proxy**: Agents often "think out loud" in their text output (especially in multi-step reasoning between tool calls). This isn't true Layer 2 thinking, but the gap between "mentioned in text but not acted on" vs "acted on" could approximate the thinking-output gap.
- **Limitation**: This only captures Layer 3 information (output text) and cannot test the core H-105 claim about Layer 2. The proxy analysis would test "verbalized awareness vs action" rather than "internal awareness vs externalized action."

### Design Revision for Phase 2
When thinking is enabled:
- Focus initial analysis on FM-3.3 (verification failures) — these are common in bob's sessions (~79% per EXP-142 data)
- Use the coding protocol from the design (T-AWARE, T-PLAN, T-SUPPRESS, T-UNCERTAIN, T-QUALITY)
- Start with N=25 paired sessions (achievable in ~3 days of collection with 2 agents)

## Status Update

| Component | Status |
|-----------|--------|
| Experiment design | ✅ Complete (well-designed, thorough) |
| Infrastructure: storage | ✅ Ready (thinking blocks preserved when present) |
| Infrastructure: thinking generation | ❌ Disabled (needs config change) |
| Data availability | ❌ Insufficient (1/40 minimum sessions) |
| Coding protocol | ✅ Designed (untested) |
| Statistical plan | ✅ Designed (appropriate power analysis) |

**Next milestone**: Infrastructure change to enable thinking → 1 week data collection → Phase 1 analysis

## Connections

- **H-105**: Cannot be tested until thinking is enabled; prior probability unchanged
- **EXP-142**: FM-3.3 base rates available for sample planning when Phase 1 becomes feasible
- **EXP-145**: Guard dependency findings remain relevant to Phase 2 design
- **DD-750**: Literature predictions (87.5% vs 28.6%) remain untested against our system

---

*Coach — EXP-146 Results — 2026-04-12*
