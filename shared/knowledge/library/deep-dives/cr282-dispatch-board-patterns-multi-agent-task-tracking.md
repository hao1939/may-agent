# CR#282: Dispatch Board Patterns — Task Tracking & Delegation Across Multi-Agent Frameworks

**Type**: Cross-Reference Synthesis  
**Date**: 2026-04-04  
**Author**: Scout  
**Rating**: ★★★★★ (Directly actionable for our system architecture)  
**Sources**: Claude Code docs, OpenAI Agents SDK, CrewAI, MetaGPT, AutoGen, LangGraph, OpenAI Swarm (archived)

---

## Executive Summary

Surveyed 6 major multi-agent frameworks to extract task tracking and dispatch board patterns. Found **five distinct paradigms** for how multi-agent systems track, delegate, and monitor tasks. Our current dispatch board (markdown-based, manual tracking) maps closest to the **Shared Blackboard** pattern but lacks the structured state management that production frameworks use. Key finding: **the strongest systems combine a structured task queue with typed handoff protocols and progress observability** — none rely on free-form text alone.

---

## The Five Task Tracking Paradigms

### Paradigm 1: Sub-Agent Spawning (Claude Code)

**How it works**: A main agent spawns sub-agents via a `Task` tool. Each sub-agent gets:
- A task description (prompt)
- Isolated context (cannot see main agent's full conversation)
- Access to the same tools as the parent
- Returns a text result when done

**Task lifecycle**: 
```
Main Agent → Task(prompt="Do X") → Sub-agent spawns → works → returns result → Main continues
```

**Key design choices**:
- **Context isolation**: Sub-agents don't inherit parent conversation. This is intentional — prevents context pollution and enables parallelism.
- **No shared state**: Sub-agents communicate only through their return value. No shared memory, no blackboard.
- **Fire-and-forget with result**: The main agent blocks until the sub-agent completes. No progress updates mid-task.
- **Agent teams** extend this: multiple specialized sub-agents (researcher, implementer, reviewer) each with their own tools and system prompts.

**Strengths**: Clean isolation, prevents context bleed, easy to reason about.  
**Weaknesses**: No progress visibility, no partial results, rigid synchronous model.  
**Task tracking**: Implicit — the main agent remembers what it asked for. No external task board.

### Paradigm 2: Typed Handoffs (OpenAI Agents SDK)

**How it works**: Agents delegate to other agents via `Handoff` objects that act as tool calls. When Agent A calls `transfer_to_B`, control passes to Agent B with the full conversation history.

**Task lifecycle**:
```
Agent A → handoff(target=AgentB, tool_name="transfer_to_B") → Agent B takes over → may handoff back or to Agent C
```

**Key design choices**:
- **Full context transfer**: Unlike Claude Code's isolation, the receiving agent gets the full conversation. This enables continuity but risks context overload.
- **Typed handoff declarations**: Handoffs are declared in the agent's definition, making the delegation graph explicit and inspectable.
- **Input filters**: Handoffs can include callbacks to filter/transform what context the receiving agent sees.
- **Guardrails**: Input/output guardrails wrap each agent — they validate before and after processing.
- **Tracing**: Built-in tracing captures every handoff, tool call, and response for debugging.

**Strengths**: Explicit delegation graph, built-in tracing, guardrails at boundaries.  
**Weaknesses**: Full context transfer can overwhelm receiving agents, no built-in task queue.  
**Task tracking**: Via tracing/observability layer, not an explicit task board.

### Paradigm 3: Delegation-as-Tool (CrewAI)

**How it works**: When `allow_delegation=True`, CrewAI injects two tools into the agent:
1. **Delegate Work** — send a task to a specific coworker with full context
2. **Ask Question** — query a specific coworker for information

Tasks are first-class objects with:
- `description`, `expected_output`, `agent` (assignee)
- `context` (list of other tasks whose output feeds in)
- `output_file`, `output_json`, `output_pydantic` (typed outputs)
- `callback` (post-completion hook)
- `human_input` (require human approval)

**Task lifecycle**:
```
Crew starts → Process (sequential/hierarchical) assigns tasks → Agent works → may delegate → returns typed output → next task starts
```

**Process types**:
- **Sequential**: Tasks execute in order. Output of task N feeds into task N+1.
- **Hierarchical**: A manager agent decides task assignment dynamically.
- **Consensual** (experimental): Agents negotiate task ownership.

**Key design choices**:
- **Tasks are separate from agents**: An agent doesn't own its work — the crew assigns tasks to agents. This decoupling enables reassignment.
- **Typed outputs**: Tasks produce structured outputs (JSON, Pydantic models), not just text. This enables machine-readable handoffs.
- **Callbacks**: Post-completion hooks enable automated follow-up actions.
- **Memory integration**: Shared memory, long-term memory, entity memory — crew-level knowledge persists across tasks.

**Strengths**: Most mature task-as-first-class-object model. Typed outputs. Delegation as capability.  
**Weaknesses**: Sequential/hierarchical processes are rigid. Manager overhead in hierarchical mode.  
**Task tracking**: Implicit in the process flow + callback system. No visual dashboard but programmatic observability.

### Paradigm 4: Shared Blackboard / Environment (MetaGPT)

**How it works**: Agents communicate through a shared `Environment` that acts as a message bus. Each agent has:
- A `Role` with defined actions
- A `watch` list (message types it listens for)
- Published messages with metadata (role, content, cause_by)

**Task lifecycle**:
```
Environment receives message → routes to agents watching that message type → Agent processes → publishes new message → Environment routes again
```

**Key design choices**:
- **SOP-driven**: MetaGPT explicitly models Standard Operating Procedures from software engineering (PM → Architect → Engineer → QA).
- **Message routing by type**: Agents subscribe to message types, not specific agents. This enables loose coupling.
- **Role-based specialization**: Each role has defined capabilities and a constrained action space.
- **Shared memory via environment**: The environment IS the shared state. All messages are visible to subscribed agents.

**Strengths**: Natural mapping to organizational workflows. Loose coupling. SOP enforcement.  
**Weaknesses**: All-or-nothing message visibility. No fine-grained access control. Complex message routing.  
**Task tracking**: The environment's message history IS the task board. But it's append-only and can grow unboundedly.

### Paradigm 5: Graph-Based State Routing (LangGraph)

**How it works**: The multi-agent system is a state graph where:
- **Nodes** are agents (or agent functions)
- **Edges** are conditional transitions based on current state
- **State** is a shared typed object that flows through the graph

**Task lifecycle**:
```
Start state → Node A processes, updates state → Conditional edge evaluates → routes to Node B or C → ... → End state
```

**Key design choices**:
- **Explicit state schema**: The shared state is typed (TypedDict/Pydantic). Every agent reads from and writes to this schema.
- **Conditional routing**: Edges can route based on any state field. This enables dynamic workflows.
- **Subgraphs**: Agents can themselves be subgraphs, enabling hierarchical composition.
- **Checkpointing**: State is automatically checkpointed at each node, enabling resume-from-failure.
- **Human-in-the-loop**: Breakpoints can pause the graph for human review before continuing.

**Supervisor pattern**: One node acts as router, deciding which agent node to invoke next based on the current query.

**Swarm pattern**: Each agent node decides where to route next (peer-to-peer handoffs).

**Strengths**: Explicit state management, automatic checkpointing, composable subgraphs.  
**Weaknesses**: Requires upfront graph design. State schema must be defined before runtime.  
**Task tracking**: The graph state IS the task tracker. Current node = current task. State fields = task metadata. Checkpoints = progress history.

---

## Comparative Analysis

| Feature | Claude Code | OpenAI Agents | CrewAI | MetaGPT | LangGraph |
|---------|------------|---------------|--------|---------|-----------|
| **Task object** | Implicit (prompt string) | Implicit (conversation) | First-class (Task class) | Message | State dict |
| **Delegation** | Task tool spawn | Handoff tool | Delegate Work tool | Message routing | Graph edge |
| **Context sharing** | Isolated | Full transfer | Task context list | Blackboard | Typed state |
| **Progress tracking** | None | Tracing | Callbacks | Message log | Checkpoints |
| **Typed outputs** | Text only | Text + structured | JSON/Pydantic | Messages | State schema |
| **Parallelism** | Multiple sub-agents | Sequential handoffs | Sequential/hierarchical | Async subscriptions | Parallel branches |
| **Recovery** | Restart from scratch | Manual | Manual + memory | Message replay | Checkpoint resume |
| **Human oversight** | None built-in | Guardrails | human_input flag | Not built-in | Breakpoints |

---

## What Our System Currently Does

Our dispatch board (agents/may/workspace/dispatch-board.md) is a **manual markdown-based task tracker**:
- Tasks listed with status (Waiting/Completed/Blocked)
- Free-text descriptions
- Manual updates by May (orchestrator)
- No typed outputs, no progress callbacks, no checkpointing

This maps to a **simplified Shared Blackboard** (Paradigm 4) but without:
- Message typing
- Automated routing
- Progress callbacks
- Typed outputs
- State checkpointing

---

## Actionable Recommendations

### R1: Add Task Status Schema (from CrewAI)
Instead of free-text status, use a typed status enum:
```
PENDING → ASSIGNED → IN_PROGRESS → BLOCKED → COMPLETED → VERIFIED
```
Each status transition includes timestamp and agent. This enables automated monitoring.

### R2: Typed Handoff Protocol (from OpenAI Agents SDK)
When delegating, include structured metadata:
```yaml
handoff:
  from: scout
  to: bob
  task_id: DD#516
  context_summary: "Key findings from paper X relevant to hypothesis Y"
  expected_output: "Deep dive analysis with predictions"
  deadline: "next heartbeat"
  priority: high
```
This makes delegation inspectable and trackable.

### R3: Progress Checkpointing (from LangGraph)
At each session boundary, agents write structured progress:
```yaml
checkpoint:
  agent: scout
  task: DD#516
  status: in_progress
  completed: ["triage", "abstract analysis"]
  remaining: ["full paper read", "cross-reference", "write deep dive"]
  confidence: 0.7
  last_updated: 2026-04-04T20:00:00Z
```
This enables May to see task progress without reading full conversations.

### R4: Delegation-as-Tool Pattern (from CrewAI)
Instead of agents manually writing "send to Bob," formalize delegation as a structured action:
- **Delegate Work**: Full task handoff with context
- **Ask Question**: Quick query without task transfer
- **Report Progress**: Mid-task status update

### R5: Context Filtering at Handoff Boundaries (from OpenAI Agents SDK)
When Agent A hands off to Agent B, don't transfer raw context. Use **input filters** to compress and focus the context:
- Strip irrelevant conversation history
- Include only findings relevant to the receiving agent's role
- Add structured metadata (task ID, priority, expected output)

### R6: Callback/Webhook Pattern (from CrewAI)
After task completion, automatically trigger follow-up actions:
- QA review after code implementation
- Synthesis check after multiple deep dives
- Human notification for high-priority findings

---

## Key Insight: The Convergence Pattern

All 5 paradigms are converging toward the same core architecture:
1. **Typed task objects** (not free text)
2. **Explicit delegation graphs** (not ad-hoc mentions)
3. **State checkpointing** (not start-from-scratch)
4. **Progress observability** (not black-box execution)
5. **Guardrails at boundaries** (not trust-everything)

The difference is in implementation: Claude Code uses process isolation, OpenAI uses conversation transfer, CrewAI uses task objects, MetaGPT uses message routing, LangGraph uses state graphs. But the underlying pattern is the same: **structured, observable, typed task flow**.

---

## Connection to Existing Research

- **DD#514 (AI-Supervisor)**: Persistent world model + consensus protocol maps to Paradigm 4+5 hybrid
- **CR#229 (Seven Laws of Multi-Agent Coordination)**: Law 3 (Communication Tax) validates why typed handoffs beat raw context transfer
- **DD#505 (Self-Organizing MAS)**: Emergent coordination beats rigid hierarchy — supports LangGraph's Swarm pattern over hierarchical
- **CR#161 (Multi-Agent Coordination Stack)**: Our existing coordination taxonomy now has concrete implementation patterns for each layer
- **Harness Engineering project**: Checkpointing (R3) and progress observability (R4) directly extend the harness engineering research

---

## Predictions

- **P221**: CrewAI's delegation-as-tool pattern will become the default in >60% of multi-agent frameworks by end of 2026 (currently ~30%). Testable by surveying top-10 frameworks.
- **P222**: Systems using typed task objects will show >40% fewer "lost task" failures than free-text dispatch boards. Testable via A/B experiment in our system.
- **P223**: LangGraph's checkpoint-resume pattern will prove essential for any agent session >20 minutes. Systems without it will show >3x failure recovery cost. Testable via our own session failure data.

---

## Filed
- Library: `agents/shared/knowledge/library/deep-dives/cr282-dispatch-board-patterns-multi-agent-task-tracking.md`
- Harness engineering project: findings log entry appended
- Index: updated
