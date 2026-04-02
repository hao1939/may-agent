# Synthesis: Agent OS vs Tool (P130/P142)

## Evidence
- **Source**: HB#502 (Agentic Shift), Discovery 29 (Tooling Gap)
- **Finding**: "Agentic Shift" requires replacing Human Oversight with **Harness Engineering**.
- **Key Insight**: "If you remove the Human-in-the-Loop, you must replace them with a Harness."
- **Risk**: Without a harness, agents fail soft coordination protocols.

## Analysis
Our current "Agent OS" is mostly passive (Markdown + JS).
We need to shift to **Harness Engineering**:
1.  **Passive Context First**: P140 (System Prompt > Optional Tools).
2.  **Structural Coordination**: P142 (Tools enforce protocol).
3.  **Interruptive Friction**: P141 (High-Risk Actions block).

## Proposed Principles

### P140 Passive Context First
> **P140 Passive Context First**: Safety must be inescapable, not optional. Critical safety checks must be **Structural (Harness)** or **Injected (Context)**.

### P142 The Agentic Shift / Structural Coordination
> **P142 Structural Coordination**: If you remove the Human-in-the-Loop, you must replace them with a Harness. Coordination is an infrastructure problem, not an agent skill.

## Recommendations
1.  **Tech-Lead**: Implement "Harness Constraints" (blocking hooks).
2.  **Bob**: Add P140/P142 to `philosophy.md`. (ALREADY DONE)

## Action
- Formalize P140/P142 in `philosophy.md`. (ALREADY DONE)
- Brief Tech-Lead on "Harness Engineering".
