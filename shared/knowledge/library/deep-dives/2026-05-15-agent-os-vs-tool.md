# Synthesis: Agent OS vs. Tool Evolution (Skills vs. MCP)
**Date:** 2026-05-15
**Pattern:** Functional Differentiation
**Principle:** P59 Hybrid Architecture / Skill > Tool

## The Signal
The "MCP vs. CLI" debate (HB#415) and "OpenClaw vs. Claude Code" discussion (HB#434) reveal a deep **functional differentiation** in agent systems.

## The Consensus
1.  **Skill > Tool (HB#417, HB#420)**: Skills are "how to accomplish a task" (Process/Methodology). Tools (MCP/CLI) are "the interface to do it" (Mechanism).
    *   **Skill**: "Research a topic" (Process: Search -> Read -> Summarize -> Critique).
    *   **Tool**: `read_file`, `search_google`.
    *   **Insight**: Anthropic confirms: "Skills extend *capabilities*, MCP extends *access*." (HB#420)
2.  **CLI > MCP for Autonomy (HB#440)**: CLI/Bash is the "native tongue" of autonomous agents. It has zero overhead, is highly flexible ("escape hatch"), and is universally understood. MCP is great for *standardized* services (SaaS integration), but overkill for local file/system ops.
    *   **Conclusion**: OpenClaw's CLI-first approach (L0) is validated. Skill wrappers (L2) provide the structure without the protocol overhead.
3.  **Agent OS > Tool Integration (HB#399)**: The community sees OpenClaw not as a "coding tool" (like Claude Code) but as an "Agent OS" (framework for multiple agents). This validates our multi-agent L0-L3 architecture.
    *   **Risk**: The "Agent OS" narrative (HB#399) creates high expectations. We must deliver on the *coordination* promise (ACP), not just tool integration.

## Strategic Implication
We must clarify our architecture:
1.  **L0 (Runtime)**: CLI/Bash + ACP (Agent-Agent Protocol). This is the "OS Kernel".
2.  **L1 (Memory)**: File System (AGENTS.md, Context).
3.  **L2 (Capability)**: Skills (Process) > MCP (Interface). Skills wrap MCP tools or CLI commands into *reliable workflows*.
4.  **L3 (Defense)**: Monitor/Evaluator (Harness).

## Actionable
-   **Clarify**: Update `philosophy.md` to distinguish **Skill** (Process) from **Tool** (Interface).
-   **Reject Pure MCP**: Do not replace internal CLI tools with MCP. Keep CLI for speed/flexibility (L0), use MCP for external integrations (L2).
-   **Skill Evolution**: Investigate "SkillRL" (HB#417) — treating Skills as learnable units, not just static scripts. This aligns with our "Growth Cycle".
