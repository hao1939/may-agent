# Cross-Reference #131: Context-Coupled vs. Context-Decoupled — Architecture Decision for Production Multi-Agent Systems

**Sources:** DD#264 (MCP Design Choices, arXiv:2602.15945), DD#234 (MADA), DD#255 (Anthropic Agent Autonomy), CR#79 (Architecture Selection Problem), CR#91 (Architecture Decision Completeness), CR#130 (Research-Practice Bridge)

## The Decision Matrix

This cross-reference synthesizes empirical evidence from DD#264 with our architecture knowledge base to produce actionable guidance on when to use context-coupled vs. context-decoupled execution in multi-agent systems.

### Context-Coupled (What We Do Now)
**Pattern:** LLM receives tool metadata → reasons about which tool → calls tool → receives output in context → reasons about result → repeat

**Strengths (empirically validated):**
- Superior for iterative/adaptive tasks (DD#264: MCP outperforms on 3-server conditional logic)
- Natural error recovery via incremental reasoning and retries
- Better for subjective aggregation (e.g., Scout evaluating paper relevance)
- Transparent decision provenance — every step visible in context

**Weaknesses (empirically validated):**
- Context window exhaustion (our 5+ compaction rounds per session)
- Token usage scales linearly with task complexity
- Dozens of reasoning-tool-reasoning turns for complex workflows
- Higher latency due to sequential execution

### Context-Decoupled (CE-MCP)
**Pattern:** LLM generates complete program → program runs in sandbox calling tools → only final result returns to context

**Strengths (empirically validated):**
- Near-constant context consumption regardless of task complexity
- Massive token savings (especially multi-server tasks)
- Can parallelize tool calls (fan-out patterns)
- Lower average latency for structured tasks

**Weaknesses (empirically validated):**
- Global orchestration errors in complex conditional logic
- Harder to recover from unexpected tool behaviors
- 16 new security attack classes (MAESTRO analysis)
- Latency outliers during tool discovery in large environments

## Mapping to Our System

| Agent/Task | Current Pattern | Recommended Pattern | Rationale |
|---|---|---|---|
| Scout: Paper analysis | Context-coupled | Stay context-coupled | Requires adaptive reasoning, semantic judgment |
| Scout: Bulk arXiv scanning | Context-coupled | Hybrid CE-MCP | Parallelizable, structured, predictable |
| Agent coordination (SIGNALS.md) | Context-coupled | CE-MCP candidate | Structured protocol, known patterns |
| File generation (impl-specs) | Context-coupled | CE-MCP candidate | Linear workflow, known output schema |
| Evaluator: Quality assessment | Context-coupled | Stay context-coupled | Subjective evaluation, needs iterative refinement |
| Tech-lead: Planning | Context-coupled | Stay context-coupled | High-stakes decisions, needs full reasoning |

## Security Implications for Our System

### Current Exposure (Context-Coupled Risks)
1. Our `bash` tool has unrestricted execution — maps to P5.1, P5.2, P5.4, P5.6
2. Tool error messages flow directly into reasoning context — vulnerable to P2.2
3. No semantic gating on tool outputs — vulnerable to P4.1
4. No discovery phase optimization — all tool metadata loaded upfront

### Recommended Security Posture
1. **For context-coupled paths:** Add semantic gating on tool returns, sanitize error messages
2. **For CE-MCP paths:** Containerized sandboxing, pre-execution code validation, output validation
3. **For both:** Rate limiting, resource caps, filesystem boundary enforcement

## The Hybrid Architecture Principle

**Key insight from DD#264:** Neither pure architecture wins. The optimal system uses context-coupled execution for tasks requiring adaptive reasoning and context-decoupled execution for structured, parallelizable workflows.

This maps directly to the GUS Meta-Pattern hierarchy:
- **Tier 3-4 (Simple to Moderate):** CE-MCP preferred
- **Tier 5-6 (Complex to Novel):** Context-coupled preferred
- **Tier 7 (Architecture Selection):** Meta-decision best done in context-coupled mode
