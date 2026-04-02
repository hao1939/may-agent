# Synthesis: The "Skill > MCP" Convergence
**Date:** 2026-03-14
**Author:** Bob (Architect)
**Sources:** HB#403 (Perplexity CTO), HB#415 (Community), HB#366 (Agentic Skill Formalization), HB#402 (DPS)

## 1. The Signal
A growing consensus in the high-leverage AI engineering community (Perplexity, levelsio, OpenClaw findings) suggests that **Model Context Protocol (MCP)** as a heavy abstraction layer is failing, while **Skills (Markdown + CLI)** are succeeding.

- **Perplexity CTO (Denis Yarats)**: Migrated *away* from MCP to API/CLI.
- **Community Consensus**: "MCP is dead," "Skill can replace MCP."
- **Academic Validation (HB#366)**: Formalized "Skill" as `S=(C, π, T, R)` where `R` (Interface) is just one part. The "Programmatic Knowledge" (`π`) is the high-value component, not the connection protocol.

## 2. The Mechanism: Why MCP "Failed" (as a Silver Bullet)
MCP attempted to solve the "Connection Problem" (How do I talk to X?) but ignored the "Intelligence Problem" (How do I *use* X effectively?).

- **The MCP Trap**: Building an MCP server gives you a tool definition (`call_database`), but it doesn't give the agent the *strategy* for querying it, the *schema* knowledge, or the *error handling* logic.
- **The Skill Solution**: A Skill file (`SKILL.md`) contains:
    1.  **Context**: When to use this.
    2.  **Strategy**: How to compose calls.
    3.  **Governance**: What is forbidden.
    4.  **The Tool**: The CLI command or API call (the "MCP" part, reduced to a primitive).

**Equation**: `Skill = Context + Strategy + Tool(MCP)`

By focusing on MCP, the industry optimized the cheapest part of the stack (connection) and ignored the most expensive (reasoning strategy).

## 3. Our Architecture Validation
This external shift validates our specific architectural choices:

1.  **Text is Policy**: We use Markdown (`agents/shared/skills/`) as the primary definition of capability.
2.  **CLI is King**: We prefer `bash` tools (CLI) over complex JSON-RPC servers.
3.  **Protocol Orthogonality**: We treated MCP as an *implementation detail* of a Skill, not the Skill itself.

## 4. The Path Forward (Consolidation)
We should explicitly **deprioritize** "Heavy MCP" (building complex standalone servers) and **double down** on "Fat Skills" (rich markdown context wrapping simple CLI tools).

**Principle P124 (Draft): Skill Wraps Tool**
* "The Tool is the hand; the Skill is the technique. A tool without a Skill file is a raw capability without intelligence. Never ship a tool without a wrapping Skill. Prefer simple CLI tools wrapped in rich Markdown instructions over complex MCP servers."

## 5. Strategic Implication
- **Stop**: Any "MCP Server" projects that add complexity without capability.
- **Start**: Refactoring existing "Tools" into "Skills". Ensure every tool in `src/lib/tools/` has a corresponding `agents/shared/skills/` wrapper that teaches the agent *how* to use it.
- **Hardening**: The "Experience Replay" failure (0 usage) suggests we have tools (the skill file exists) but no *habit*. The "Skill" needs to be injected into the "System" (Standard Operating Procedure).

## Conclusion
The industry is converging on our "Skill-Centric" architecture. We are ahead of the curve. We must not regress into "MCP Hype."
