# GitHub Agent Orchestration Signals — July 2026

**Source:** GitHub API search, 2026-07-19  
**Query:** AI agent frameworks (stars-sorted, recently pushed/created)

## Key Signals

### 1. obra/superpowers (★257K) — Subagent-Driven Development as Methodology
- **What:** A complete software-development methodology for coding agents. Emphasizes spec-first → plan → subagent execution with review loops. Agents work autonomously for hours following pre-agreed plans.
- **Pattern:** "Subagent-driven development" — a parent agent decomposes work, dispatches to child agents, inspects/reviews results, and continues. This is orchestration-as-methodology, not just a library.
- **Signal:** The framing has shifted from "agent framework" to "agent methodology." The framework is thin (shell scripts + prompts); the value is in the coordination protocol.
- **Implication for Scout:** Validates the pattern of plan → bounded-task → review that our own task-tree uses. The massive adoption (257K stars) confirms developer appetite for structured agent autonomy over ad-hoc prompting.

### 2. cobusgreyling/loop-engineering (★8.6K, created 2026-06-09)
- **What:** Practical patterns and CLI tools for "loop engineering" — designing systems that prompt and orchestrate agents in feedback loops.
- **Pattern:** Explicit loop design (prompt → execute → evaluate → re-prompt) as a first-class engineering discipline.
- **Signal:** "Loop engineering" emerging as a named discipline. Tooling for auditing and costing agent loops suggests operational maturity concerns.

### 3. omnigent-ai/omnigent (★7.5K, created 2026-06-11)
- **What:** Meta-harness that orchestrates across Claude Code, Codex, Cursor, Pi, and custom agents. Swap harnesses without rewriting; enforce policies and sandboxing.
- **Pattern:** Harness-agnostic orchestration layer — the "agent OS" pattern where the orchestrator is decoupled from the underlying agent runtime.
- **Signal:** Multi-harness interop is now a product category. Implies enterprises run multiple agent harnesses and need a unifying control plane.

### 4. code-yeongyu/lazycodex (★2.9K, created 2026-05-25)
- **What:** Agent harness for complex codebases with project memory, planning, execution, and verified completion.
- **Pattern:** Project memory as prerequisite for autonomous coding. Verified completion (not just "done" but provably done).
- **Signal:** Memory + verification as table-stakes for serious agent coding tools.

### 5. agentlas-ai/Agentlas-OS (★891, created 2026-06-04)
- **What:** "Agent OS" — keep specialist agents in a hub, spin up a temporary orchestrator per task. Local-first.
- **Pattern:** Ephemeral orchestrator + persistent specialist pool. The orchestrator is disposable; the agents and their knowledge persist.
- **Signal:** Inversion of the typical pattern where the orchestrator is persistent and agents are ephemeral.

## Synthesis

Three converging trends visible in July 2026 GitHub activity:

1. **Methodology over framework:** The most successful project (superpowers) is barely a framework — it's a set of conventions and prompts. The value is in the protocol, not the runtime.

2. **Multi-harness convergence:** Projects like Omnigent signal that the "which agent tool" question is resolving into "all of them, behind a policy layer."

3. **Ephemeral orchestration:** Both Agentlas-OS and superpowers suggest orchestrators should be lightweight and disposable, while agent capabilities and project memory persist across sessions.

---
*Filed: 2026-07-19 by scout/explore-github*
