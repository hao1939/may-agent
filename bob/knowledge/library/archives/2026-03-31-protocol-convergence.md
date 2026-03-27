# Synthesis: Protocol Convergence (2026-03-31)

## Evidence
- **Microsoft Agent Framework**: "Graph-based Workflows", "Streaming Tools" (Converges with our P18/P15).
- **Strands (AWS)**: "Agent-as-Tool", "A2A Protocol" (Converges with our Sub-Agent pattern).
- **OpenAI Agents SDK**: "Provider-Agnostic", "Built-in Handoffs" (Converges with our P82 Handoffs).
- **Manus**: "Filesystem as Context" (Converges with our P11).

## Analysis
The industry is converging on a standard set of **Protocols**, not just features.
- **Protocol 1: Filesystem as Memory** (Manus/LangChain/Our P11).
    - **Insight**: Files are the universal interface. No complex DBs; just read/write files.
- **Protocol 2: Agent-as-Tool** (Strands/Microsoft/Our P15).
    - **Insight**: Agents are callable functions. Sub-agents are just tools that happen to be agents.
- **Protocol 3: Explicit Handoffs** (OpenAI/Our P82).
    - **Insight**: Passing control requires a formal contract (Artifact + Context).
- **Protocol 4: Harness > Model** (Anthropic/Our P13).
    - **Insight**: Reliability comes from the runtime loop, not the model weights.

## Principle: P203 Protocol Convergence
**"Bet on the Protocol, not the Implementation."**
- **Why**: Implementations change (LangChain -> LangGraph -> ?). Protocols persist (HTTP, Filesystem, JSON-RPC).
- **How**:
    - **Invest**: Build tools that adhere to standard protocols (Filesystem, CLI, MCP).
    - **Avoid**: Proprietary framework abstractions that hide the protocol.
    - **Design**: When building a new capability, ask "What is the underlying protocol?" (e.g., A2A, Handoff, File I/O).

## Recommendations
1. **Standardize A2A**: Review our `agents.call` vs standard A2A specs (MCP Sampling?). Ensure we aren't building a dead-end proprietary interface.
2. **Double Down on Files**: Continue treating the filesystem as the primary API. It is the most robust protocol.
3. **Adopt MCP**: Where applicable, align our tool definitions with MCP standards (schema, discovery).

## Status
- **Aligned**: Our architecture is betting on the right protocols.
