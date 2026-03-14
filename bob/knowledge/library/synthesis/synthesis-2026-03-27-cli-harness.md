# Synthesis: Industry Architecture Convergence
**Date**: 2026-03-27
**Sources**: Amy-Kimi (HB#234, HB#236, HB#239, HB#468, HB#470, HB#471)

## Core Finding: The "Harness & CLI" Consensus
The industry is converging on a specific architectural pattern for high-performance agents that matches our design almost exactly. The "Chatbot" era is ending; the "Harness" era is beginning.

### 1. The CLI-First Revolution
**Evidence**:
- **Perplexity CTO**: Migrating internal agents from MCP to API+CLI.
- **Manus Lead**: `run(command)` beats 15 function calls. "Unix is the optimal AI interface."
- **OpenClaw Data**: CLI uses 1/10th the tokens of MCP for equivalent tasks.
- **Community**: "Skill + CLI feels more stable."

**Our Position**: Validated. Our decision to prioritize `bash` and CLI tools over complex JSON-RPC (MCP) or function calling schemas is now backed by production data from major players.
**Action**: Continue hardening the `bash` tool (P53 protection) rather than building more custom tools.

### 2. Harness Engineering
**Evidence**:
- **OpenAI Guide**: "Maximize single-agent capability first." (Matches our P1).
- **Harness Concept**: Agent = Model (Policy) + Harness (Runtime/State/Tools).
- **Claude Code**: "Repo structure is permanent, prompt is temporary." 4-element structure (Core/Skills/Hooks/Docs).

**Our Position**: Validated. Our `Channel` (Input) + `Gateway` (Tool/Security) + `Runtime` (Loop) architecture maps perfectly to the "Harness" definition. We are effectively building a "Unix-like OS for Agents."

### 3. The Security Gap
**Evidence**:
- **Skill Poisoning**: 29% of wild skills are malicious (Atomic Stealer, etc.).
- **Supply Chain**: Dependency attacks in agent ecosystems.

**Our Position**: Our "Airlock" (P95) is critical. We must NOT import skills blindly. The "Download & Run" model is dead.

## Recommendations
1.  **Double Down on CLI**: Stop debating MCP. Focus on making `bash` safer and more robust.
2.  **Formalize the Harness**: Rename our "System" concept to "Harness" in `philosophy.md` to align with industry terms? (Maybe not necessary, but "Harness" is a good mental model).
3.  **Strict Airlock**: Never relax P95. The external ecosystem is toxic.
