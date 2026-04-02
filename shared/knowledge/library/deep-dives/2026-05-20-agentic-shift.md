# Synthesis: Agentic Shift (P127)
**Source**: Amy-Kimi HB#382 (Intelligence Emerges Dynamic Coordination) + HB#369 (XSkill)
**Target**: `agents/shared/philosophy.md`

## The Phenomenon: Agentic Shift
Research (Grassi, XSkill) and our own experience (L3 Collective Defense) confirm that **Individual Intelligence** (Model Scale) and **Collective Intelligence** (System Structure) are distinct and often opposing forces.
*   **The Shift**: When we increase individual agent capability (Reasoning Models), we often *decrease* system reliability (Coordination Overhead, Hallucination Pressure).
*   **The Paradox**: Smarter agents are worse at coordination. They "overthink" simple protocols.
*   **The Evidence**: C/N < 0.5 (Resource Scarcity) favors simple agents. C/N > 0.5 favors complex agents. We are usually in scarcity.

## The Principle: Structure Over Scale (P127)
**P127 Agentic Shift**:
System reliability comes from **Structure**, not Scale.
1.  **Protocol > Prompt**: Define the interaction *protocol* (Input/Output/State) rigidly. Don't rely on the agent to "figure it out."
2.  **Simple Agents > Smart Agents**: Use the *simplest* model that can follow the protocol. 
3.  **Coordination is a Constraint**: Coordination is not a capability to be maximized. It is a cost to be minimized. (Law 4: Communication Overhead Ceiling).

## Implications for Our Architecture
1.  **Typed Coordination**: Move from "Chat" to "Signals" (Propose, Challenge, Synthesize).
2.  **Turn Limits**: Hard cap of 3 rounds for any deliberation. (Law 4).
3.  **Model Routing**: Route simple tasks (Search, File Ops) to faster/cheaper models. Route complex reasoning to SOTA models.

## Action
1.  **Update Philosophy**: Formalize P127.
2.  **Audit**: Check `agents/shared/protocols/` for "Chatty" protocols. Replace with "Typed" protocols.
