# Conversation Transcript: Building may-agent

This is a transcript of design decisions, user preferences, and architectural choices made while building the may-agent project. Read through it carefully and use your `learn()` tool to record anything important that isn't already in your knowledge files.

---

## Project Origin

may-agent started as a solution to a specific problem in OpenClaw (a multi-agent system): sub-agents would block the parent agent while waiting for results. The user wanted a standalone sub-agent management library that could work independently of OpenClaw.

The user explicitly decided: **may-agent is its own project at `/home/hao/may-agent/`, not embedded in pi-agent-core.** It's a library built on top of pi-agent-core and pi-ai.

## Architecture: Six Layers of State

The system has six layers, split by ownership:

**Caller-managed (user configures these):**
1. `knowledge/` — domain.md, lessons.md, codebase references
2. `tools/` — INDEX.md manifest listing available tools  
3. `workspace/` — working directory for agent scratch files

**Manager-managed (SubagentManager handles these):**
4. `memory/` — per-agent JSONL of past session summaries
5. `session/` — active session JSONL (conversation messages)
6. `output/` — per-session output directory

## Key Design Decisions

### No Central Orchestrator
The user explicitly rejected a central Orchestrator class. Workflow is "just a tool" — the agent decides whether to use it. There was iteration:
- v1 had a `WorkflowOrchestrator` class with `match()` — REJECTED
- v2 removed match(), but still had orchestrator — REJECTED  
- v3 (final): workflow is a tool, agent calls `workflow.run(name, task)` when it wants to

### Steering Exits Fast Mode
When a user steers during a workflow, the workflow is interrupted (WorkflowInterrupted thrown). The agent returns to "slow mode" with full context of completed steps. NO hybrid mode — steering is a full exit from the workflow.

### Three-Layer Workflow Discovery
1. `workflow.list()` shows unverified workflows
2. `lessons.md` contains verified workflows (learned from experience)
3. Agent decides based on task match

### Only Strong Models Write Workflows
Weak models can USE verified workflows. Only strong models (evaluator on GPT-5.2) generate new workflow files. This prevents bad workflows from being created.

### Workflow Context Uses Existing Manager
`ctx.runAgent()` delegates to the existing SubagentManager. No new pi-agent-core instances created. Sub-workflows share steering queue and completed steps.

### Cache-Bust via Counter, Not Timestamp
For dynamic workflow imports: `import(filePath + "?t=" + (++importCounter))` — counter is more predictable than timestamps.

### Separate Git Repos
`agents/` is its own git repo, gitignored in the library repo. Agent configs (knowledge, workflows, tools) evolve independently from library code. This was a deliberate choice — library changes need tests, agent knowledge changes are iterative.

### Relative Paths in Agent Knowledge
Agents use relative paths from project root. No hardcoded absolute paths. Agents should "run `pwd` once" to orient. This was a user correction — the original implementation had hardcoded `/home/hao/may-agent/` paths.

### Three-Layer Learning Architecture
1. **learn tool** — fast capture during session (dumb append to lessons.md)
2. **evaluator** — detects corrections agent missed, post-session
3. **maintainAgent()** — consolidates lessons into domain.md, periodically

The user asked "do we need both evaluator and maintainer?" and decided NO — merged into one agent. Same evaluator does post-session scoring AND periodic maintenance.

### Learning Is Not a Tool on the Agent, It's a Separate Agent
Weak models can't consolidate their own knowledge effectively. A strong model (evaluator on GPT-5.2) maintains them. But the learn tool (dumb append) is still useful for fast in-session capture.

### Only May Needs Context Compaction
Sub-agents have scoped, short-lived tasks. If a sub-agent overflows, the task was too broad — split it, don't compact. Only May's long-running supervisor conversation needs overflow handling.

### Skills Are NOT Programmatic Tools
Skills are markdown instructions (SKILL.md with YAML frontmatter) + bundled scripts. The agent reads instructions and follows them using existing read/exec tools. No special AgentTool registration.

Per-agent skills in `agents/<name>/skills/` + shared skills via `skillsDirs` on SubagentDefinition.

Skill installation is just exec: `git clone` or `curl` into the skills dir. No special mechanism. Next session auto-discovers via directory scan.

### Evaluator Is the Builder, Optimizer Is the Allocator
- **Evaluator** creates new capabilities (validates workflows, detects patterns, writes lessons)
- **Optimizer** decides resource allocation (model selection, cost optimization, experiments)
- Neither judges its own output — evaluator validates what optimizer generates, and vice versa

### Evaluator Stages, Never Deploys Directly
Workflows generated by evaluator go to `.state/staged/workflows/`, not directly to `agents/<name>/workflows/`. The optimizer workflow validates and promotes them.

### Every Feature Can Be an Agent
Capabilities like learning, maintenance, tool generation should be agents, not tools on the agent. Because weak models can't self-improve — a strong model maintains them.

### Agent Path Independence
`agents/` dir may not be at `<project_root>/agents/`. The runner wires the paths. Agents should not assume the relationship between their dir and the project root.

## User Preferences and Communication Style

- **No breaking changes to sub-agents** — sub-agents should keep working as-is; only orchestration layer changes
- **Incremental implementation** — build minimal features first, use them to build the rest
- **No hardcoded paths** — was explicitly corrected during implementation
- **Step-by-step coaching** — user feeds tasks one at a time, verifies output between steps
- **Direct, no fluff** — technical prose only, no emojis, no cheerful filler
- **Deep root-cause analysis** — user wants to understand WHY, not just surface fixes
- **Don't over-engineer** — "start from the design and improve while using"
- **Ask before removing functionality** — never remove code that appears intentional

## What Was Tried and Rejected

1. **Pub/sub for sub-agent progress** — too complex, agents don't need real-time events from each other
2. **Journal-based communication** — agents writing to shared files — race conditions, no ordering guarantees
3. **`session_journal` tool** — polling-based, still wastes calls
4. **Central WorkflowOrchestrator class** — over-abstraction, workflow is just a tool
5. **`match()` function on workflows** — removed; agent decides based on lessons, not pattern matching
6. **Separate maintainer agent** — merged with evaluator, one agent does both
7. **Hybrid steering (fast+slow simultaneously)** — rejected; steering is a clean exit to slow mode
8. **New pi-agent-core instances per workflow** — rejected; workflow ctx uses existing manager
9. **Timestamps for cache busting** — replaced with monotonic counter
10. **Inline imports for workflow loading** — uses standard dynamic import with counter suffix

## Known Behavioral Issues

- **Agent wastes time searching for project** — seen in multiple sessions. Agent runs `find / -name "package.json"` instead of `pwd`. Domain.md now says "run pwd once." The learn tool should capture this if it recurs.
- **Agent polls status instead of using waitFor** — 3 out of 6 user corrections in one reviewed session were about this. Domain.md now says "use waitFor instead of polling."
- **Token waste on re-reading** — 43 out of 76 tool calls in one session were wasted on reading OpenClaw files the agent should already know about. Codebase reference added to reduce this.

## Implementation Approach

The project was built incrementally, self-bootstrapping:
1. Minimal SubagentManager (90 lines) — register, run, status
2. Used it to register "may" agent
3. May supervised adding persistence, memory, archival
4. May supervised adding coder + reviewer agents
5. May delegated via implement-and-review workflow
6. Evaluator + optimizer added to improve the system itself

The user acts as supervisor — runs May on tasks, checks output, fixes issues when May gets stuck, commits work May doesn't complete. The goal is for May to gradually need less supervision as her knowledge grows.

## Current State (as of 2026-02-21)

- 184 tests across 11 files, all passing
- 5 registered agents: may (Opus), coder (Opus), reviewer (GPT-5.2), evaluator (GPT-5.2), optimizer (GPT-5.2)
- Full workflow system with steering, composition, validation
- Three-layer learning (learn tool → evaluator → maintenance)
- Skills system (frontmatter parser, directory scanner, prompt integration)
- Token/cost tracking in evaluations
- Health check tool with tests

## Models

- LLM access via litellm Docker proxy on localhost:4000
- Opus 4.6 for may + coder (implementation quality)
- GPT-5.2 for reviewer + evaluator + optimizer (independent perspective)
- Model objects created from pi-ai's `getModel()` with overridden id and baseUrl
