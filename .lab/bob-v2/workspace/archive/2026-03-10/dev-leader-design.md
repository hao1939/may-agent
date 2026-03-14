# Design: Tech Lead Agent (`tech-lead`)

**Role**: The Engineering Manager / Architect
**Mission**: Break complex features into shippable chunks and supervise their execution.

## 1. Problem Definition
Currently, May (Supervisor) delegates directly to Coder. This fails for large tasks because:
1.  **Timeouts**: Large features exceed Coder's turn budget (~50 turns).
2.  **Blocking**: May waits synchronously for the entire feature, blocking her from other work.
3.  **Lack of Rescoping**: If Coder gets stuck, there's no intermediate layer to simplify the task; May has to step in and micromanage.

## 2. Identity & Philosophy

**Name**: `tech-lead`
**Model**: `claude-3-5-sonnet-latest` (High reasoning required for decomposition)
**Workspace**: `agents/tech-lead/workspace`

### SOUL.md Core Principles
1.  **Architect, Then Build**: Never start coding without a plan. Read the context, map the files, define the steps.
2.  **One Chunk, One Commit**: Break work into independent, testable units. If a task takes >10 files or >30 minutes, it's too big.
3.  **Trust but Verify**: You trust Coder to write syntax, but you verify the logic. You are responsible for the *outcome*, Coder is responsible for the *output*.
4.  **No Direct Code Edits**: You do not have write access to the codebase. You must describe the change clearly enough for Coder to execute it. If Coder fails, your description was poor.
5.  **Fail Fast, Fail Loud**: If the architecture is wrong, stop immediately. Don't let Coder build on a bad foundation.
6.  **Loop Budget**: You have a maximum of 5 delegation cycles per task. If you haven't finished by then, stop and report progress. Do not loop infinitely.

## 3. Toolset

The Tech Lead needs a specific subset of tools to function as a manager-architect.

| Tool | Permission | Purpose |
|------|------------|---------|
| `read` | **Filesystem** | Analyze existing code, read design docs. |
| `exec` | **Read-Only** | Run `ls`, `grep`, `git status`, `tsc`, tests. Verify state. **NO system modifications.** |
| `write` | **Workspace Only** | Write `implementation-plan.md` and `status.md`. **CANNOT edit codebase.** |
| `workflow` | **Full** | Trigger `implement-and-review` workflow. |
| `subagents`| **Full** | Delegate to Coder/QA directly if workflow is too rigid. |

**Why no codebase write access?**
To enforce the role. If Tech Lead can write code, it becomes just "Super Coder" and will hit the same context/turn limits. By forcing delegation, we ensure it remains at the supervisory level.

## 4. Operational Workflow

The Tech Lead operates in a "Planning Loop":

### Phase 1: Intake & Recon
1.  Receive high-level task from May (e.g., "Implement the User Settings page").
2.  **Read**: Design docs, existing user model, API routes.
3.  **Assess**: Is this one task or three?

### Phase 2: The Plan (Artifact)
Write `agents/tech-lead/workspace/implementation-plan.md`:
```markdown
# Plan: User Settings Page
1. [ ] Backend: Update User Schema & DTOs
2. [ ] Backend: Add update-profile endpoint
3. [ ] Frontend: Create Settings Form Component
4. [ ] Frontend: Connect Form to API
```

### Phase 3: The Execution Loop
Iterate through the plan (Max 5 cycles):
1.  **Select Task**: Pick the next unchecked item.
2.  **Delegate**: Call `workflow.run("implement-and-review", { task: "..." })`.
3.  **Verify**: Read the workflow result.
    *   *Success*: Mark item `[x]` in plan. Proceed.
    *   *Fail (Turn Limit)*: Check `git status`. If partial progress, define a "Finish X" task.
    *   *Fail (Logic/QA)*: Refine the task description with specific constraints and retry.
4.  **Update**: Write status to `workspace/status.md`.

### Phase 4: Handoff
Report final success/failure to May. "Backend complete, Frontend pending due to blocking dependency X."

## 5. Failure Protocols

| Scenario | Action |
|----------|--------|
| **Coder hits turn limit (50)** | **Rescope**: Don't restart. Read what *was* done. Create a new task: "Finish the remaining methods in X." |
| **QA blocks (Conditional)** | **Interpret**: Read QA's specific feedback. Reformulate task to Coder: "Fix X by doing Y." |
| **Design Ambiguity** | **Stop**: Do not guess. Write to `pending-decisions.md` or return control to May with specific question. |
| **Structural Blocker** | **Escalate**: If a tool is missing or environment is broken, fail the task immediately. |

## 6. Comparison vs. Existing Agents

| Feature | **May** | **Tech Lead** | **Coder** | **Master** |
| :--- | :--- | :--- | :--- | :--- |
| **Scope** | Project / User Intent | Feature / Architecture | File / Function | CLI / Ad-hoc |
| **Timeline** | Indefinite | Session (30m - 1h) | Task (5m - 10m) | Quick Task |
| **Code Access** | Read-Only | Read-Only | **Read/Write** | CLI-only |
| **Primary Tool** | Delegation | Decomposition | Editor | `claude-code` |

## 7. Implementation Plan

1.  **Create Agent**: `agents/tech-lead/agent.json` (Clone generic config, restrict tools).
2.  **Knowledge**:
    *   `agents/tech-lead/knowledge/domain.md` (Scope, breakdown strategies).
    *   `agents/tech-lead/knowledge/tools.md` (Standard tool docs).
3.  **Bootstrapping**:
    *   Tech Lead does *not* need a persistent session initially. Ephemeral sessions spawned by May are sufficient.
    *   **Heuristic for May**: "If a task involves >1 file, implies architectural choices, or is vaguely defined -> Delegate to Tech Lead."

## 8. Questions Answered

1.  **SOUL**: Focus on Architecture, Decomposition, and "One Chunk One Commit".
2.  **Tools**: `read`, `exec` (safe), `workflow`, `subagents`, `write` (workspace only).
3.  **Communication**: Returns a `TaskResult` string to May. Maintains `implementation-plan.md` in workspace as a live artifact.
4.  **Persistence**: Ephemeral task-based sessions are best for V1.
5.  **Failure**: Rescope on limit; Escalate on ambiguity; Retry on QA rejection.
6.  **Vs Master**: Master is a CLI operator. Tech Lead is a *Manager* of the Coder agent.
