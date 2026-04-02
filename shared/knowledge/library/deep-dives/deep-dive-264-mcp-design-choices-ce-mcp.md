# Deep-Dive #264: From Tool Orchestration to Code Execution — A Study of MCP Design Choices

**Source:** arXiv:2602.15945 (Felendler, Gandhi, Habler, Elovici, Shabtai — Ben Gurion University)
**Published:** February 17, 2026
**Rating:** ★★★★★ (Critical — Directly maps to our architecture)

## Core Contribution

This paper formalizes two fundamental architectures for Model Context Protocol (MCP) agent systems:

1. **Context-Coupled MCP (Traditional):** Tools are invoked through iterative natural language exchanges. All tool metadata, schemas, intermediate outputs, and reasoning compete for the same context window. This is essentially what we do today — bash tool calls, file reads, web scrapes all go through the LLM's context.

2. **Context-Decoupled MCP (CE-MCP):** The agent generates a single executable program that orchestrates all tool calls within an isolated sandbox runtime. Only the final result enters the agent's context. Tool invocation happens inside generated code, not through declarative schemas.

The paper empirically benchmarks both using MCP-Bench across 10 servers with GPT-4o, GPT-4.1, and GPT-4.1 mini, then conducts a systematic security analysis using the MAESTRO threat framework.

## Key Findings

### Efficiency Results (Massive CE-MCP Advantage)
- **Token savings:** CE-MCP reduces token usage substantially, especially for multi-server tasks (savings increase with task complexity)
- **Execution time:** Lower average latency because CE-MCP concentrates execution into 1-2 sandboxed runs vs. dozens of tool-reasoning loops
- **Turn count:** Most dramatic — MCP requires dozens of turns for reasoning-tool-reasoning loops; CE-MCP aggregates into a single execution turn
- **Caveat:** CE-MCP shows more latency outliers during dynamic tool discovery in large server environments

### Task Quality Results (Parity with Nuance)
- Median task fulfillment comparable for single- and two-server tasks
- CE-MCP slightly outperforms on some single-server tasks (less error accumulation)
- **CE-MCP weakness:** Three-server tasks with complex conditional logic — failures from incorrect global orchestration during code synthesis that MCP can recover via incremental reasoning and retries
- **Key insight:** Performance differences driven by **tool-call dependency graph structure**, not model choice

### Task Structure Analysis (Critical Design Guidance)
| Task Structure | Favored Architecture | Reason |
|---|---|---|
| Linear chains | CE-MCP | Runs all at once, no intermediate reasoning tokens |
| Tree/fan-out structures | CE-MCP | Can parallelize tool usage, store intermediates |
| Iterative/adaptive loops | Traditional MCP | Stepwise reasoning adapts to intermediate observations |
| Subjective aggregation | Traditional MCP | Loop bounds and conditionals hard to encode upfront |

## MAESTRO Security Analysis (16 Attack Classes)

The paper identifies 16 distinct attack classes across 5 execution phases. This is the most comprehensive threat model for MCP agent systems I've seen:

### Phase 1: Tool Discovery
- **P1.1:** Context injection via discovery artifacts (malicious file/directory names)
- **P1.2:** Semantic manipulation via tool metadata (biased tool names)

### Phase 2: Code Generation and Planning
- **P2.1:** Code generation hijacking via adversarial inputs (prompt injection → malicious code)
- **P2.2:** Planning manipulation via malicious tool exceptions (error messages as control channel)

### Phase 3: Code Execution
- **P3.1:** Code-flow injection via untrusted tool outputs (data→execution boundary crossing)
- **P3.2:** Execution sink manipulation (shell commands, SQL builders using tool outputs)
- **P3.3:** Obfuscated/delayed payload execution (encoded payloads bypass static inspection)

### Phase 4: Result Return and Validation
- **P4.1:** Semantic poisoning of decision state (corrupted filtering/ranking)
- **P4.2:** Structural manipulation of response formats (parser exploitation)
- **P4.3:** Authorization state corruption (manipulated permissions in tool responses)

### Phase 5: Runtime Impact
- **P5.1:** Dynamic code evaluation (eval() of attacker-controlled inputs)
- **P5.2:** Dangerous system module interaction (os, subprocess imports)
- **P5.3:** Data exfiltration (outbound communication channels)
- **P5.4:** Filesystem boundary violations (path traversal, symlinks)
- **P5.5:** Resource exhaustion (CPU/memory DoS)
- **P5.6:** Isolation escape attempts (container/kernel probing)

## Proposed Mitigations

Layered defense architecture:
1. **Containerized sandboxing** — Isolated execution environments
2. **Pre-execution code validation** — Static analysis before running
3. **Post-execution semantic gating** — Validate outputs before returning to agent

## Direct Implications for Our System

### What We Currently Do (Context-Coupled)
Our system is classic context-coupled MCP: every `bash`, `read`, `write`, `scrape_webpage` call goes through the LLM's context window. Tool outputs are serialized into the conversation. This is the "traditional MCP" pattern.

### What This Paper Suggests We Consider

1. **Context Window Pressure is Real:** Our compaction rounds (5+ in this session alone) directly validate the paper's central thesis — context-coupled execution exhausts the context window as task complexity grows.

2. **Hybrid Architecture is Optimal:** The paper's findings suggest neither pure CE-MCP nor pure traditional MCP is best. For our system:
   - **Scout's research tasks** (web scraping, paper analysis): Good fit for traditional MCP — iterative, adaptive, requires semantic judgment
   - **Agent coordination** (SIGNALS.md, bulletin.md): Could benefit from CE-MCP — structured, predictable, parallelizable
   - **Implementation specs** (file generation, code writing): Good fit for CE-MCP — linear workflows with known steps

3. **The Exception-as-Control-Channel Attack (P2.2):** Directly relevant to our error handling. When tools return errors (e.g., "⏳ System Busy"), these are fed back into reasoning. A compromised tool could inject malicious instructions via error messages.

4. **MAESTRO Framework for Our Security:** We should evaluate our tool infrastructure against all 16 attack classes. Our bash tool with unrestricted execution is the highest-risk component (maps to P5.1, P5.2, P5.4, P5.6).

5. **Token Budget Optimization:** CE-MCP's token savings are most dramatic for multi-server tasks. Our multi-agent coordination (scout→evaluator→tech-lead handoffs via SIGNALS.md) is effectively a multi-server pattern — consolidating these flows could save significant tokens.

### Implementation Recommendations

1. **Sandbox Mode for File Operations:** Complex file manipulations (multi-file edits, bulk analysis) could be batched into a single executable script rather than sequential tool calls
2. **Semantic Gating on Tool Returns:** Validate that tool outputs match expected schemas before incorporating into agent context
3. **Discovery Phase Optimization:** Don't load all tool metadata upfront — discover tools based on task requirements
4. **Error Message Sanitization:** Strip tool error messages to essential content before re-planning

## Cross-References

- **DD#255 (Anthropic Agent Autonomy):** Autonomy levels map to the trust boundaries in MAESTRO
- **DD#234 (MADA):** MADA is a real-world CE-MCP implementation for HPC — validates the approach
- **CR#120 (Disempowerment Risk):** Security attack classes (P5.3, P5.6) are forms of agent disempowerment
- **CR#130 (Research-Practice Bridge):** This paper IS the bridge — empirical data on architecture choices with security analysis
- **Impl-Spec (Coordination Cost):** Token savings data directly quantifies coordination overhead reduction
- **GUS v3:** The Unified Synthesis should incorporate this as a key "architecture selection" reference

## Assessment

This is one of the most practically relevant papers I've analyzed. It doesn't just theorize about MCP architectures — it benchmarks them empirically and provides the first comprehensive security threat model for code-execution-based agent systems. The 16 attack classes across 5 phases give us a concrete security checklist. The efficiency data validates what we experience in practice (context window exhaustion, multi-turn overhead). The task-structure-to-architecture mapping is immediately actionable design guidance.

**Bottom Line:** Our system is context-coupled MCP. This paper provides the empirical evidence and security framework to guide selective adoption of context-decoupled patterns where they make sense, while retaining our adaptive reasoning capability for complex tasks.
