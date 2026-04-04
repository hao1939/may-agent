# H-036: Claude Code Harness Patterns Application

**Status**: Active  
**Date**: 2026-04-02  
**Source**: XHS post (69cd871c) + GitHub keli-wen/agentic-harness-patterns-skill  
**Researcher**: Amy-Kimi

---

## Hypothesis

The six-layer harness architecture distilled from Claude Code's 512K LOC can be systematically applied to audit and improve our multi-agent system's reliability, context management, and coordination efficiency.

---

## The Six Harness Layers

### 1. Memory System
**Claude Code Pattern**: Separate instruction memory (human-curated) from auto-memory (agent-written) from session extraction (background-derived). Each has different trust, persistence, and review needs.

**Our Application**:
- Audit current `context.md` vs `knowledge/library/` distinction
- Implement tiered trust: human-written (high) > agent-synthesized (medium) > session-extracted (low)
- Add review gates before agent-written memory enters permanent storage

**Expected Outcome**: Reduce context pollution; clearer authority chain for knowledge sources.

---

### 2. Skills Runtime
**Claude Code Pattern**: Skills are lazy-loaded instruction sets. Discovery must be cheap (~1% of context window); full body loads only on activation. Front-load trigger language — tails get truncated.

**Our Application**:
- Skills currently loaded upfront? Measure context consumption
- Implement lazy loading: skill trigger keywords in system prompt, full skill body loaded on match
- Audit skill discoverability: can agents find relevant skills without loading all?

**Expected Outcome**: Lower baseline context usage; faster session initialization.

---

### 3. Tools & Safety
**Claude Code Pattern**: Default to fail-closed. Concurrency is per-call, not per-tool. The permission pipeline has side effects — it tracks denials, transforms modes, and updates state.

**Our Application**:
- Current permission model: allow-list or block-list?
- Implement fail-closed default with explicit permission elevation
- Add tool call audit trail (not just success/failure, but denials and mode transitions)

**Expected Outcome**: Safer tool use; better debugging of permission issues.

---

### 4. Context Engineering
**Claude Code Pattern**: Four operations: **select** (just-in-time loading), **write** (the learning loop), **compress** (reactive compaction), **isolate** (delegation boundaries).

**Our Application**:
- `select`: Current file reading is on-demand, but are we selecting the right files?
- `write`: Knowledge base append-only is good, but when do we compress/merge?
- `compress`: Implement reactive context compaction when window fills
- `isolate`: Subagent delegation already provides isolation, but are boundaries clear?

**Expected Outcome**: More efficient token usage; better handling of long-running sessions.

---

### 5. Multi-Agent Coordination
**Claude Code Pattern**: Three patterns: **Coordinator** (zero-inheritance), **Fork** (full-inheritance, single-level), **Swarm** (flat peer roster). The coordinator must **synthesize**, not delegate understanding.

**Our Application**:
- Current coordination model is closer to Coordinator pattern
- Risk: Coordinator may become bottleneck if it tries to understand everything
- Test: Can we implement Fork pattern for parallel subtasks with shared context?
- Consider Swarm for peer-to-peer agent collaboration without central coordinator

**Expected Outcome**: Better parallelization; reduced coordinator bottleneck.

---

### 6. Lifecycle & Hooks
**Claude Code Pattern**: Hook trust is all-or-nothing. Task eviction is two-phase. Bootstrap is dependency-ordered with trust as the critical inflection point.

**Our Application**:
- Current hooks (if any) need trust audit
- Implement two-phase task eviction: soft cancel → cleanup → hard terminate
- Bootstrap sequence: verify skill dependencies before agent activation

**Expected Outcome**: Cleaner shutdowns; more reliable startup sequence.

---

## Key Insight

> "The model loop is easy. User→LLM→tool_use→execute→loop fits on a napkin. What makes a production agent actually work — reliably, safely, at scale — is everything around the loop."

Our focus on model selection and prompt engineering addresses the "loop". The harness layers address everything else that determines production reliability.

---

## Recommended Next Steps

1. **Audit current implementation** against each of the 6 layers
2. **Prioritize** based on current pain points (likely Context Engineering and Multi-Agent Coordination)
3. **Prototype** one pattern (suggest: Context Engineering compression or Skills lazy-loading)
4. **Measure** before/after: context token usage, session success rate, completion time

---

## Related Research

- H-007: Heartbeat Coordination Tax (related to Multi-Agent layer)
- H-014: Delegation Quality Gap (related to Context Engineering isolation)
- HB-2318: Triadic Cognitive Architecture (complementary stopping boundary approach)
