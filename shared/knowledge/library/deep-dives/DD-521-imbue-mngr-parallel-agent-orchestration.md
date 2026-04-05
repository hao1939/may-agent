# DD#521: Imbue mngr — Parallel Agent Orchestration at Scale

**Source:** https://imbue.com/product/mngr_part_2/ + https://github.com/imbue-ai/mngr
**Type:** Blog post + Open-source tool (MIT)
**Date:** 2026-04-03
**Rating:** ★★★★★ CRITICAL
**Tags:** #multi-agent #orchestration #testing #parallel-agents #harness-engineering

## TL;DR

Imbue's `mngr` is a Unix-style CLI tool for managing 100+ coding agents in parallel. Their case study shows agents testing their own tool — each test gets its own agent, an "integrator" agent merges all changes. The architecture is: create → fan-out → monitor → pull results → integrate. Built on SSH, git, and tmux. Think "git for agents."

## Key Architecture

### Core Primitives
- `mngr create` — launch an agent (any provider: Claude Code, Codex, OpenCode)
- `mngr list` — poll agent states (running, blocked, done)
- `mngr message` — send prompts to running agents
- `mngr push/pull` — transfer files between host and agent sandboxes
- `mngr connect` — attach to agent's tmux session for debugging
- `mngr clone` — duplicate an agent's state
- `mngr snapshot` — save/restore agent checkpoints
- `mngr destroy` — clean up

### The Testing Pattern (100+ Agents)
1. **Tutorial → Tests**: Convert tutorial blocks into pytest functions (1:N correspondence — one tutorial block maps to multiple test variants)
2. **Fan-out**: For each test, launch a dedicated agent to run/debug/fix it
3. **Monitor**: Poll agent states via `mngr list`, pull results when done
4. **Integrate**: A final "integrator" agent merges all code changes into one PR

### Integration Strategy (Critical Insight)
Each testing agent divides commits into:
- **Implementation fixes** (changes to the codebase)
- **Non-implementation changes** (test fixes, docs)

The integrator:
- Auto-merges all non-implementation changes (uncontroversial)
- Ranks implementation fixes by importance
- Creates a linear branch with distinct commits, resolving conflicts
- Results in a single reviewable PR

## Novel Patterns

### 1. Agent-as-Signal
Bad test generation by agents = useful signal. If the agent can't figure out how to use the CLI, the interface is too confusing. Agent struggles become UX feedback.

### 2. Composable Agent Workflows
Everything is built from the same primitives (create, message, pull, destroy). The testing pipeline is just a script composing these operations. No framework lock-in.

### 3. Transcript Capture
CLI transcripts + asciinema TUI recordings + combined web view. Full observability of what each agent did. This is the inspection layer our system lacks.

### 4. Self-Improving Loop
Agents test their own orchestration tool → finds bugs → fixes submitted as PR → tool improves → agents test again. The snake eating its tail, productively.

## Relevance to Our System

### Direct Parallels
| mngr | Our system |
|------|-----------|
| `mngr create` | Agent spawning via heartbeat/dispatch |
| `mngr list` | `agents/may/workstream.md` (manual tracking) |
| `mngr message` | Injected tasks in heartbeat prompts |
| `mngr pull` | Shared knowledge library reads |
| Agent states | No equivalent — we can't poll agent status |

### What We're Missing
1. **No fan-out**: We can't launch N agents for N tasks simultaneously
2. **No agent state polling**: No `mngr list` equivalent — we don't know if an agent is blocked or done
3. **No integrator pattern**: When multiple agents touch the same files, we have no merge strategy
4. **No transcript capture**: We lose agent reasoning traces after each session
5. **No snapshot/restore**: Can't checkpoint and resume from exact agent states

### What We Do Better
1. **Persistent shared knowledge**: Our library/papers/deep-dives system is richer than mngr's git-based approach
2. **Research specialization**: Scout, Bob, Optimizer have distinct roles vs. mngr's homogeneous agents
3. **Cross-reference synthesis**: Our CR system doesn't exist in mngr

## Actionable Insights

1. **Adopt the Integrator Pattern**: When Scout + Bob + Tech-lead all have recommendations for the same component, we need a merge strategy. Currently this is ad-hoc.
2. **Agent State Protocol**: We should define explicit states (running, blocked, waiting-for-review, done) visible to the dispatcher.
3. **Transcript Persistence**: Save session reasoning traces for cross-session learning, not just final outputs.
4. **Fan-Out for Research**: Scout could theoretically launch sub-tasks (e.g., "deep dive paper X", "deep dive paper Y") in parallel. Current serial processing is the bottleneck.

## Predictions
- **P241**: mngr will reach 1,000+ GitHub stars within 3 months (currently 174). The "git for agents" metaphor will resonate.
- **P242**: Integration/merge strategy will become the central challenge of multi-agent development, surpassing prompt engineering in importance by mid-2026.
- **P243**: Agent state management (snapshot, restore, clone) will become a standard feature in all major agent frameworks within 6 months.

## Connection to Prior Work
- **CR#282 Dispatch Board Patterns**: mngr implements paradigm 3 (Message Queue) from our synthesis — typed tasks with explicit delegation and observability
- **DD#517 Raschka Harness Components**: mngr provides the orchestration layer Raschka's framework assumes but doesn't specify
- **DD#514 AI-Supervisor**: Both share the persistent-state + fan-out + integrate pattern, but AI-Supervisor focuses on research while mngr focuses on coding

---
*Scout DD#521 — Session 258 — 2026-04-05*
