# DD#881: Tool Attention — Dynamic Tool Gating and Lazy Schema Loading

**Paper:** arXiv:2604.21816 (Sadani & Kumar — Apr 2026)
**Relevance:** ★★★★ HIGH
**Tags:** #tool-management #context-efficiency #MCP #lazy-loading

## Core Problem

MCP (Model Context Protocol) requires injecting full tool schemas into every LLM turn. With many tools across multiple servers, this "Tools Tax" consumes 10k-60k tokens per turn — wasting context window, degrading reasoning (fracture point ~70% utilization), and increasing cost.

## Solution: Tool Attention

Three-component middleware:

1. **Intent-Schema Overlap (ISO) Score:** Embed the user query and each tool description via sentence embeddings. Score overlap. Only tools above threshold proceed.

2. **State-Aware Gating:** Check preconditions (e.g., "user must be authenticated") and access scopes. Filter out tools that can't execute in current state.

3. **Two-Phase Lazy Schema Loading:**
   - **Phase 1:** Keep a *compact summary pool* in context — one-line descriptions of all tools (~50 tokens total vs ~400 tokens per full schema).
   - **Phase 2:** Promote full JSON schemas only for top-k gated tools into context.

## Results (simulated 120-tool benchmark)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Per-turn tool tokens | 47.3k | 2.4k | -95% |
| Context utilization | 24% | 91% | +67pp |

⚠️ **Caveat:** Task success, latency, cost are *projected* from token counts + published telemetry — not measured on live agents.

## Relevance to Our System

### Direct Parallels
- **Our skills/ directory** = their tool registry. Each agent loads skills into context. As skills grow, we face the same "tools tax."
- **Context.md + SOUL.md** already consume significant context. Adding many skill schemas compounds this.
- **DD#873 (Tool Overuse Illusion)** showed agents invoke tools unnecessarily — partially because all tools are presented equally in context. Tool Attention's gating would reduce this.

### Actionable Ideas

1. **Lazy Skill Loading:** Instead of injecting full skill definitions, keep one-line summaries in TOOLS.md. When the agent's task matches a skill (via keyword/embedding match), promote the full definition. This is implementable now without model changes.

2. **State-Aware Gating for Skills:** Some skills only apply in certain states (e.g., "deploy" skills only when code is ready). Adding preconditions to skill metadata would reduce irrelevant options.

3. **Compact Tool Summaries:** Audit current tool/skill descriptions for bloat. The paper's finding that summaries preserve selection accuracy means we can aggressively compress.

### Connection to H-079
H-079 proposes structured message schemas. Tool Attention's lazy loading is the complementary idea: structured *tool* schemas with progressive disclosure. Both reduce context waste.

## Limitations
- Simulation only, no live agent evaluation
- Embedding-based matching may miss novel tool uses (the "unknown unknown" problem)
- Requires middleware layer we don't currently have
