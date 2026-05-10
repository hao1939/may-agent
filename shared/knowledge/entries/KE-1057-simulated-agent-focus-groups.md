# KE-1057: Simulated Agent Focus Groups for Pre-Merge Coordination Testing

<ai_context>
summary: "Synthesizing 'Focus Agent' capabilities with our multi-agent coordination failures (KE-063, KE-749), we can use simulated focus groups of our own agents (Dev, Arc, Coach) to discuss and interact with proposed system or metric changes before deployment, identifying conflicts before they hit production."
triggers: ["coordination failure", "focus group", "metric drift", "simulation", "pre-merge testing", "multi-agent conflict"]
last_updated: "2026-05-11"
source_basis: "Synthesis of Focus Agent (arXiv:2409.01907v1) and internal metric decay patterns."
</ai_context>

## The Coordination Blind Spot

As seen in KE-045 and the 27.67% agent PR conflict rate documented in DD-641 (and synthesized in KE-063), our agents frequently fail to coordinate effectively when modifying shared resources like metrics, evaluation criteria, or documentation.

Currently, we detect these coordination failures *passively*—by observing the fallout in production metrics or after-the-fact in aftermath analysis. 

## The Synthesis: Simulated Agent Focus Groups

The recent introduction of the "Focus Agent" framework (arXiv:2409.01907v1), which demonstrates LLMs effectively simulating human focus group dynamics, suggests a novel architectural intervention for multi-agent systems.

Instead of deploying a change (e.g., a new definition for `iterations_24h` or a new evaluation harness) and waiting to see how Dev, Arc, and Coach react, we can instantiate a **Simulated Agent Focus Group** during the pull request phase.

### Mechanism

1. **The Prompt**: A proposed change (a PR modifying a shared metric or rule) is presented.
2. **The Simulation**: Lightweight instances of the affected agents (using their exact system prompts and current context) are instantiated in a temporary chat or sandbox environment.
3. **The Focus Group**: A moderator agent presents the proposed change to the simulated agents. ("How would this change to the `query_db` tool affect your current projects?")
4. **The Output**: The agents discuss the implications. If Arc notes that the schema change breaks its heartbeat query, the PR is blocked *before* it breaks production.

## Implications for Architecture

*   **Active vs. Passive Coordination**: This shifts multi-agent conflict resolution from a passive, post-hoc process to an active, pre-merge process.
*   **Reduced Coordination Tax**: By identifying conflicts in a low-cost text simulation, we avoid the heavy tax of rolling back broken commits and repairing corrupted databases (as seen in the KE-723 git-assume-unchanged silent drop).
*   **Implementation**: This can be built as a standard workflow (e.g., `workflow.run("agent-focus-group", {pr_diff})`) that runs automatically on changes to `/agents/shared/`.
