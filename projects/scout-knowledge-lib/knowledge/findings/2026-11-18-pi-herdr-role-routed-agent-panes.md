<ai_context>
summary: "A current XHS practitioner account describes using Pi as a lightweight coding harness and Herdr as a pane-based supervisor: one primary agent decomposes work, launches specialist agents, assigns models by role, and exposes each session for human observation or interruption. The account also surfaces an unresolved session-grouping limitation and supplies no implementation, cost, quality, or reliability measurements."
triggers: ["xhs", "Pi", "Herdr", "multi-agent coding", "model routing", "agent panes", "human oversight", "6ae95cad0000000003021a7b"]
last_updated: "2026-11-18"
source_basis: "Complete readable body and visible comments of XHS post 6ae95cad0000000003021a7b inspected on 2026-11-18. Scout did not inspect the author's configuration, prompts, repositories, logs, costs, outputs, or comparative measurements."
</ai_context>

# Pane-based agent routing makes orchestration visible, not verified

Date: 2026-11-18  
Source: https://www.xiaohongshu.com/explore/6ae95cad0000000003021a7b  
Author: 曹德宝  
Tags: xhs, coding-agent, orchestration, model-routing, terminal, oversight

## Observation

A current XHS practitioner post describes a coding workflow built from **Pi + Herdr**. The author says one primary agent decomposes work and uses Herdr to open terminal panes, start additional agents, assign tasks, read their output, and wait for completion. Each worker remains visible in a separate pane, allowing the human operator to see which session is active or stuck and to interrupt one that drifts. The author also reports reconnecting from a Mac to a WSL host over SSH without losing the running sessions.

The stated reason for splitting work is role-sensitive model allocation rather than agent count by itself:

- use a stronger model for planning;
- use a cheaper or ordinary model for implementation when appropriate;
- choose review capacity according to task difficulty;
- keep small changes in one agent instead of paying coordination overhead;
- hold the harness constant when comparing models.

The author prefers Pi because it exposes a smaller default surface and can be extended only when needed. That is a practitioner preference, not measured evidence that fewer visible tools or instructions improved outcomes.

Visible comments add one concrete operational friction: a commenter says Herdr's session grouping was insufficient for their workflow and caused them to stop using it after one day; a reply says workspaces can provide grouping. Other commenters question whether separate panes improve on switching models or sharing messages directly inside Pi. The thread does not resolve those alternatives with comparative evidence.

## Scout interpretation

The useful signal is a separation between three layers that are often collapsed into “multi-agent coding”:

1. **role policy** decides whether work should be split and which model fits each role;
2. **agent control** launches sessions, passes assignments, reads results, and waits for completion;
3. **operator projection** renders sessions as panes so a person can observe and interrupt them.

Pane visibility improves supervisory access, but it does not prove that the primary agent decomposed the task correctly, that a worker's output satisfied its assignment, or that review was independent. A production version should retain machine-readable assignment, result, model, cost, artifact revision, verification, and interruption receipts rather than treating terminal visibility as the audit record.

The post also gives a useful negative rule: do not split work merely because parallel agents are available. Delegation should have an expected benefit—specialized capability, latency reduction, or cheaper model routing—that exceeds handoff and review cost. Keeping one harness while changing models can support comparison only if task inputs, context, budgets, tools, and acceptance checks are also controlled.

## Evidence limitations

- This is one self-reported practitioner workflow, not a controlled evaluation.
- Scout did not inspect the author's Pi extensions, Herdr configuration, prompts, task handoffs, source code, generated patches, logs, token use, latency, or failures.
- No measurements compare the described multi-agent workflow with one agent, direct model switching inside Pi, or another orchestrator.
- The SSH continuity, autonomous pane control, and model-routing behavior were described in the post but not independently reproduced.
- Visible comments are anecdotal and may omit replies or later changes.

## Related knowledge

- [Herdr: Agent Multiplexer](./2026-07-09-hn-arxiv-github-scan-456.md#herdr-agent-multiplexer-new--232pts-13749) records broader discovery and ecosystem evidence for pane-based agent supervision.
- [Agent-team review needs enforced roles and executable evidence](./2026-11-17-xhs-team-review-needs-enforced-roles-and-executable-evidence.md) explains why named roles and visible separation do not by themselves establish independent acceptance.
- [Harness choice changes both cost and correctness](./2026-10-02-harness-choice-cost-correctness.md) covers the need to evaluate model-harness pairs rather than attributing outcomes to the model alone.
