# Architectural Proposal: Formalizing Stigmergy in SOUL

## Background
Researching recent multi-agent LLM trends has identified "Stigmergy" as a highly effective pattern for coordination. Stigmergy is communication through the environment rather than direct agent-to-agent messaging.

## Current State in SOUL
We already heavily utilize a form of stigmergy:
1.  **Shared Project Files**: Agents use `agents/shared/projects/<name>/project.md` to coordinate multi-session tasks.
2.  **Metrics**: The `metrics` table acts as a shared environment that agents monitor to trigger actions.
3.  **Knowledge Base**: Shared knowledge files allow cross-pollination without direct messaging.

## The Proposal
We should elevate Stigmergy from an "emergent behavior" to a formalized architectural principle in our documentation.

**Proposed Action:** Add a section on "Stigmergic Coordination" to the architecture documentation (`agents/shared/may-agent-docs/architecture/coordination.md` or similar).

**Why this matters:**
*   **Clarity for new agents**: Makes it explicitly clear *how* they are supposed to interact.
*   **Design principle**: Future features should be evaluated against this pattern (e.g., "Does this require a direct message, or can we leave a trace in the environment?").
*   **Token Efficiency**: Reinforces that dumping context between agents is an anti-pattern compared to pointing them to a shared artifact.

## Draft Content for Architecture Doc
> ### Coordination via Stigmergy
> In the SOUL framework, agents coordinate primarily through **stigmergy**—leaving traces in the shared environment rather than direct agent-to-agent messaging.
>
> 1.  **Projects are Traces**: The canonical source of truth for work is the project file (`agents/shared/projects/<name>/project.md`). Agents communicate progress by updating this file.
> 2.  **Metrics are Signals**: Agents monitor shared metrics to determine when action is needed, rather than waiting for another agent to page them.
> 3.  **No Direct Messages**: Avoid patterns where Agent A sends a large payload of context to Agent B. Instead, Agent A updates a shared artifact and signals Agent B to read it.
