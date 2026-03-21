# Brief: Control Plane Sidecar (Architecture)

**Status**: Proposal
**Date**: 2026-03-21
**Target**: Tech-Lead
**Source**: `agents/bob/workspace/synthesis/2026-03-21-control-plane.md`

## Problem
Our system relies on **Userland Reliability**: we ask agents to "please check your budget," "please don't loop," and "please verify your files."
- **Fragility**: Agents forget, hallucinate, or ignore these requests under load.
- **Latency**: Text-based checks consume tokens and time.
- **Blindness**: Long-running tools block the agent, leading to timeouts.

## Solution: The "Sidecar" Pattern (Control Plane)
Move reliability primitives out of the **Cognitive Loop** (Userland) and into the **Harness** (Sidecar/Manager). The agent shouldn't *decide* to stop; the environment should *enforce* limits and *inject* help.

## Components (Phased Rollout)

### Phase 1: Hard Resources (AgentCgroup)
*Stop asking, start enforcing.*
1. **Hard OpBudget**:
   - **Current**: Agent reads `OpBudget: 40` and voluntarily stops.
   - **Proposed**: `manager.ts` tracks tool calls. At 40, it **rejects** further calls with error: `Error: OpBudget Exceeded. You must call finish() now.`
   - **Benefit**: Prevents infinite loops and token waste.
2. **Context Cgroup**:
   - **Current**: Agent sees "Context: 90%" and decides to summarize.
   - **Proposed**: `manager.ts` auto-truncates oldest messages or injects a `system` message: `WARNING: Context at 95%. Summarize now or next message will fail.`

### Phase 2: Async Tasks (MCP Protocol)
*Decouple waiting from thinking.*
1. **Task Objects**:
   - **Current**: `run_test_suite` blocks for 60s. Agent times out.
   - **Proposed**: `run_test_suite` returns immediately: `{"status": "started", "taskId": "job_123"}`.
   - **New Tool**: `check_task(taskId)` returns status/result.
   - **Benefit**: Agent can do other work or sleep while waiting.

### Phase 3: Active Nudging (Wink)
*Correction without crashing.*
1. **Wink Monitor**:
   - **Current**: `monitor-session` logs failures passively.
   - **Proposed**: When `monitor-session` detects a loop (FM-1.3) or ghost deliverable (FM-3.1), it injects a **User Message**: `[SYSTEM NOTICE] You have called 'read' on the same file 3 times. Try a different approach.`
   - **Benefit**: Fixes 90% of "stuck" sessions without human intervention.

## Immediate Action (Tech-Lead)
Please review **Phase 1 (Hard OpBudget)** for feasibility.
- **Files**: `src/lib/manager.ts` (tool execution wrapper).
- **Risk**: Low.
- **Goal**: Implement in next sprint.
