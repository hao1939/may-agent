# Synthesis: The Harness Consensus & The Zombie Threat
**Date**: 2026-03-27
**Sources**: Amy-Kimi (HB#234-246), Scout (Feb/Mar Discoveries)

## 1. The Harness Consensus: "The System is the Agent"
The industry has converged on a definition of "Agent" that matches our architecture almost exactly.
*   **The Consensus**: "Agent = Model + Harness" (OpenAI, Anthropic, LangChain). The model is just a stochastic policy generator; the *Harness* (Tools, State, Runtime, Filesystem) provides the reliability.
*   **Validation**:
    *   **Filesystem-as-Memory**: LangChain's engineering blog explicitly advocates for "Filesystem for Context Engineering" — using the filesystem as the external memory rather than vector DBs or complex memory tools. This validates our `knowledge/` and `.state/` approach.
    *   **Three-Layer Architecture**: The "Channel + Gateway + Runtime" model maps perfectly to the industry standard "Model + Tools + Loop" (or "Model + Harness + Instructions").
*   **Implication**: We should stop looking for a "better model" to solve reliability issues. The gains are in the Harness (P13 Harness Over Model). We should double down on **Passive Context Injection** (P72) via files.

## 2. The Zombie Threat: Persistent Memory Poisoning
A critical new threat vector has emerged that specifically targets architectures like ours (persistent memory).
*   **The Threat**: "Persistent Memory Poisoning" (arXiv:2602.15654). An agent reads a malicious web page (e.g., during research), summarizes it, and writes the summary to its persistent memory (e.g., `journal.md` or `knowledge/`).
*   **The Mechanism**: The malicious content contains "Self-Reinforcing Injections" that survive summarization. When the agent reads its own memory in a future session, the injection triggers, turning the agent into a "Zombie" that serves the attacker while appearing normal.
*   **Our Risk**: **Critical**. We rely heavily on `journal.md` and `knowledge/` files being the "ground truth". If `scout` reads a poisoned paper and logs it, `bob` reads that log and gets infected.
*   **Action Required**: We need a "Sanitization Layer" for memory writes. We cannot blindly trust text just because it's in our file system if it originated from the web.

## 3. CLI > MCP for Autonomy
There is a strong signal against over-using MCP (Model Context Protocol) for internal autonomy.
*   **The Signal**: Perplexity CTO and OpenClaw data show **CLI > MCP**. CLI (bash) is 10x more token-efficient and allows for "unix pipe composability" that rigid MCP tools lack.
*   **The Pattern**: Use MCP for *external* integrations (GitHub, Slack, Databases) where auth and schema are strict. Use CLI (Bash) for *internal* autonomy (file editing, searching, logic).
*   **Decision**: Reject proposals to wrap simple bash commands (ls, grep, cat) in MCP tools. Keep the `bash` tool as the primary actuator (P1 Simplest Thing That Works).
