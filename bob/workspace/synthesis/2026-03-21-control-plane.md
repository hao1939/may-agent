## Synthesis: Control Plane for Reliable Agents (2026-03-21)

This document synthesizes findings from recent research (AgentCgroup, MCP Tasks, Wink, AgentConductor) into a cohesive "Control Plane" architecture for reliable agent operation.

### The Problem: Userland Fragility

Our current system relies heavily on "Userland" mechanisms (prompts, text-based supervision, voluntary tool usage) for reliability.
- **Resource Control**: Agents manage their own budgets via text. (Fragile)
- **Task State**: Long-running tasks are fire-and-forget. (Blind)
- **Recovery**: Intervention requires crashing or full restarts. (Heavy)
- **Topology**: Agent relationships are static. (Rigid)

Research suggests these functions should move to a dedicated **Control Plane**—an infrastructure layer that manages resources, state, and recovery *outside* the agent's cognitive loop.

### 1. Resource Control: AgentCgroup (OS-Level)
*Source: arXiv:2602.09345 (AgentCgroup)*

**Insight**: Agents exhibit "bursty" resource usage (tool calls spike memory/CPU). Userland controls (text budgets) are too slow and coarse.
**Mechanism**:
- **Granularity**: Resource limits applied per *tool call*, not per session.
- **Enforcement**: External monitor (eBPF in paper, `manager.ts` in our case) enforces limits, not the agent itself.
- **Application**:
  - **OpBudget**: Currently a text prompt. Should be a hard limit in `manager.ts` that cuts off tool execution.
  - **Memory**: Context window is a resource. `manager.ts` should enforce "Context Cgroup" (truncation/summarization) automatically, not ask the agent to "please summarize."

### 2. Task Reliability: MCP Tasks (Protocol-Level)
*Source: MCP SEP-1686*

**Insight**: Long-running tool calls (scans, builds) are unreliable in a synchronous request/response loop.
**Mechanism**:
- **Call-Now, Fetch-Later**: Tool returns a `taskId` immediately.
- **Protocol State**: The platform (not the agent) polls or waits for completion.
- **Application**:
  - **Async Tools**: Identify "heavy" tools (e.g., `audit-codebase`, `run-test-suite`).
  - **Task Object**: Wrap these in a Task interface. Agent gets a receipt, checks back later (or gets notified).
  - **Benefit**: Decouples agent "thinking time" from "waiting time." Prevents timeout crashes.

### 3. Misbehavior Recovery: Wink (Async Intervention)
*Source: arXiv:2602.17037*

**Insight**: 30% of trajectories drift. Restarting is expensive.
**Mechanism**:
- **Async Observer**: A separate, lightweight model watches the trajectory in real-time.
- **Injection**: When drift is detected (Reasoning Loop, Tool Failure), it injects a "nudge" prompt *into the context* without stopping the session.
- **Application**:
  - **Monitor-Session**: Our `monitor-session` script is the observer.
  - **Active Nudging**: Instead of just logging "FAIL", it should inject a system message: *"You are repeating step X. Try Y."*
  - **Status**: [IN-PROGRESS] Phase 3 endorsed by Tech-Lead. Brief: `agents/bob/workspace/sent/brief-active-nudging.md`. Handlers: `agents/may/handlers/active-nudge.ts`.
  - **Benefit**: Resolves 90% of misbehaviors without data loss.

### 4. Topology Evolution: AgentConductor (Dynamic Graph)
*Source: arXiv:2602.17100*

**Insight**: Static hierarchies (Supervisor -> Worker) are suboptimal for varying task difficulties.
**Mechanism**:
- **Dynamic Graph**: The "Conductor" (Manager) assesses task difficulty *before* dispatch.
- **Topology Selection**:
  - Simple Task -> Direct Worker (Low Latency).
  - Complex Task -> Supervisor + Worker (High Reliability).
  - Novel Task -> Planner + Executor + Critic (High Robustness).
- **Application**:
  - **Manager Routing**: `manager.ts` currently has static routing. We can introduce a "Complexity Assessor" step that chooses the team structure.

### Proposed Architecture: The "Sidecar" Pattern

Instead of building these into the Agent (Userland), we build them into the **Session Harness** (Sidecar).

```
[Agent (Cognitive)] <---> [Sidecar (Control Plane)] <---> [World]
                                   |
                                   +-- Resource Governor (AgentCgroup style)
                                   +-- Task Manager (MCP Tasks style)
                                   +-- Drift Monitor (Wink style)
```

**Immediate Actions (Low Hanging Fruit):**
1. **Hard OpBudget**: Move check from `common-sense.md` to `manager.ts` (tool execution gate).
2. **Wink Nudges**: Update `monitor-session` to inject corrective prompts for simple loops (FM-1.3).
3. **Async Receipts**: For long tools, return "Task Started (ID: xyz)" and add a `check_task(id)` tool.

### Connection to Philosophy
- **P13 Harness Over Model**: This is pure harness improvement.
- **P1 Simplest Thing**: Hard limits are simpler than prompt engineering.
- **P42 Minimalism**: Remove "please manage your budget" text; replace with code that manages it.
