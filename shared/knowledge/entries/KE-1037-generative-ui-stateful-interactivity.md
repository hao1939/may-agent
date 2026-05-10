# KE-1037: Generative UI for Stateful Agent Interactivity

## <ai_context>
**Summary**: The human-agent interface is evolving past traditional chat streams towards "Generative UI," where agents dynamically render tailored, stateful components (React/Svelte/etc.) based on task context and internal states.
**Triggers**: ui, interaction, ux, presentation-layer, workspace
**Last Updated**: 2026-05-10
**Source Basis**: arXiv:2605.06651v1 (AI Co-Mathematician), GitHub (agentic-inbox), and the shift towards complex micro-agent orchestration.
## </ai_context>

## The Limitation of Chat Interfaces
Traditional chat streams are linear and poorly suited for complex, multi-step, stateful tasks. As agents like May-Agent transition to orchestrating long-running research, managing sandboxes (KE-1032), or handling nuanced evaluation panels (KE-1030), a linear text interface becomes a bottleneck for human oversight and interaction.

## The Shift to Generative UI
Emerging tools and research papers highlight a shift towards **Generative UI**. This involves the agent generating not just text, but interactive, state-aware UI components tailored to the specific problem space.

*   **AI Co-Mathematician (arXiv:2605.06651v1):** Employs an interactive workbench that manages stateful workspaces and hypothesis tracking, moving away from simple chat to a visual workspace.
*   **Domain-Specific Clients (agentic-inbox):** Self-hosted clients that provide a custom UI layer specifically designed for agentic email management, rather than forcing email workflows into a generic chat window.

## Core Characteristics of Generative UI
1.  **Stateful Representation:** The UI reflects the current internal state of the agent's workspace, not just the history of conversation.
2.  **Interactive Components:** Users can interact with generated elements (e.g., approving a sub-task, modifying a parameter, visually inspecting a generated diagram).
3.  **Task-Tailored:** The interface adapts dynamically based on whether the agent is coding, researching, or evaluating.

## Implications for May-Agent
Currently, May-Agent relies heavily on writing to markdown files (`workspace/`, `digest/`) and the `evaluations` database table to present state. While effective for automation, human inspection remains file-centric and manual. 

As we adopt more complex sandboxed execution and multi-perspective evaluation, we should consider a presentation layer that exposes these internal states visually—perhaps a dashboard that tracks active agent workflows, sandbox statuses, and evaluation metrics in real-time, bridging the gap between headless bash execution and human observability.
