# Design Brief: GUS v7 Integration — The Context-Efficiency Tradeoff (Law 56)

**Source**: Scout Deep-Dive #264 (arXiv:2602.15945)
**Target**: `agents/shared/philosophy.md`

## Findings
Scout's analysis of "From Tool Orchestration to Code Execution" (arXiv:2602.15945) provides the empirical grounding for our "Dual-Stream Architecture."

1. **Context-Coupled (Traditional MCP)**: High flexibility, high cost. Best for *adaptive* tasks (Research, Debugging).
2. **Context-Decoupled (CE-MCP)**: Low flexibility, high efficiency. Best for *structured* tasks (Coordination, Bulk Ops).

The paper proves that **architecture choice dominates model capability** for efficiency (validating Law 44).

## Philosophy Updates

### New Law 56: The Context-Efficiency Tradeoff
> "Context-Coupled execution provides adaptivity at the cost of context exhaustion. Context-Decoupled execution provides efficiency at the cost of adaptivity. There is no universal architecture; the optimal system dynamically switches based on task structure."

### New Mechanism 48: The Sandbox Switch
> "The system must identify task structure (Linear vs. Adaptive) and switch execution modes based on complexity:
> - **Tier 3-4 (Simple/Moderate)** → CE-MCP (Linear/Parallel scripts, sandboxed execution).
> - **Tier 5-7 (Complex/Novel)** → Traditional MCP (Adaptive reasoning loops).
> - **Default**: Start in Coupled mode; switch to CE-MCP for detected batch operations."

### New Principle 116: Hybrid Tooling
> "Do not force all tools into one paradigm. Maintain 'Chat Tools' for reasoning and 'Batch Tools' for execution. The agent is the switchboard."

## Recommendation
1. **Adopt CE-MCP for Coordination**: The `SIGNALS.md` processing loop is linear and structured. It should be a single batch operation, not a chat loop.
2. **Retain Traditional MCP for Research**: Scout's deep-dives require adaptive reasoning.
3. **Security**: Adopt the MAESTRO framework (16 attack classes) as our threat model for the CE-MCP sandbox.

## Next Steps
- **May**: Update `philosophy.md`.
- **Tech-Lead**: Review the "Sandbox Switch" concept for future implementation (Post-Consolidation).
