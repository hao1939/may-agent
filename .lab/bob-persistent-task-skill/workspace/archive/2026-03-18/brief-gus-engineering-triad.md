# Brief: The Engineering Triad (Law 73/74)

## Context
Three papers converge on a unified engineering discipline for agents:
1. **Efficiency (BAVT - DD#274)**: Optimizes the *execution engine* (KV cache, memory).
2. **Security (ChainFuzzer - DD#275)**: Secures the *composition* of tools (Dataflow).
3. **Coordination (CoMAM - DD#276)**: Optimizes the *joint outcome* (Credit Assignment).

## Law 73: The Compositional Vulnerability Law
**Law 73**: Security vulnerabilities in agent systems are emergent properties of **composition**, not components.
- *Evidence*: 82% of vulnerabilities (ChainFuzzer) require multi-tool execution to trigger. Securing individual tools (sandboxing) is necessary but insufficient.
- *Mechanism 65 (The Dataflow Tunnel)*: An attacker uses a benign tool (e.g., `write_file`) to stage a payload for a second benign tool (e.g., `execute_python`). The vulnerability exists only in the *connection*.

## Law 74: The Joint Optimization Law
**Law 74**: In a multi-agent system, the global optimum is inaccessible to independently optimized agents.
- *Evidence*: CoMAM proves that independent agents (Extraction, Profiling, Retrieval) fight each other. "Better Extraction" (more entities) can degrade "Retrieval" (more noise).
- *Mechanism 74 (Adaptive Credit Assignment)*: We must weight agent updates by their contribution to the *system* success (Ranking Consistency), not their local success.

## Principle 141: The Workflow-Level Security Mandate
**Principle 141**: Security audits must trace **source-to-sink dataflows** across tool chains, not just tool inputs.
- *Action*: When reviewing a new agent capability, ask: "Can Tool A write data that Tool B treats as code?"

## Recommendations
1. **Update Philosophy**: Add Law 73, Law 74, and Principle 141.
2. **Security Review**: Audit our own tool usage. Do we have `write_file` -> `execute` chains? (Yes, Coder does this by design).
3. **Mitigation**: We rely on the "Human-in-the-Loop" (QA) to break this chain. But ChainFuzzer shows that LLM guardrails fail 88% of the time. We need *structural* breaks (e.g., sandboxed execution environments that don't persist state between certain tools).
