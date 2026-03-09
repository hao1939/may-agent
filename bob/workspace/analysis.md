
# Analysis of Recent Agent Patterns (2026-03-09)

## 1. The "Lost Agent" Pattern
Multiple recent sessions (e.g., `s_1773032730225_178`) show agents getting lost in the filesystem or hitting permission errors, then frantically searching with `find /` or `ls -R`.

**Symptoms:**
- Agent tries to read a file at absolute path `/root/workspace/todo.md` (does not exist in container).
- Fails with ENOENT or EACCES.
- Immediately runs `find /` or `ls -R /` to locate it.
- Often blocked by security constraints (scanning `/root` or `/`).

**Root Cause:**
- Agents (especially ephemeral ones) assume a `/root/workspace` structure that doesn't match the `/app` container layout.
- They don't know their own `CWD` is `/app`.

**Fix Proposal:**
- **Environmental**: Inject `CWD` and `WORKSPACE_ROOT` into the system prompt for all agents.
- **Structural**: `exec` tool should auto-inject `pwd` into every error message (already done? check `agents/may/tools/exec.js`).
- **Correction**: If an agent tries to read `/root/workspace/...`, intercept and rewrite to `/app/agents/{agent}/workspace/...`.

## 2. "Read Churn" Pattern
High incidence of `read -> read -> read` sequences (33 in recent sample).

**Symptoms:**
- Agent reads a file, then reads another, then reads another — without taking action.
- Often re-reads the same file or files it just listed.

**Root Cause:**
- Lack of "Context Persistence" across turns?
- Or just efficient information gathering (batch reading)?
- Needs deeper look: are they reading *different* files (good) or the *same* file (bad)?

## 3. "Blind Apply" Pattern
Sequence: `read` -> ... -> `write` -> `exit`.
- If the `write` is the last action, there is no verification.
- Violation of "Verify-on-Edit" principle.

**Fix Proposal:**
- **Workflow**: Enforce `safe-edit` (which includes verification) for all code changes.
- **Prompt**: "Always read back what you wrote to confirm it matches expectation."

# Action Items

1. **Fix Lost Agents**: Update `agents/shared/system-design.md` or base prompt to explicitly state: "Your workspace is at `/app/agents/{agent}/workspace`. Do NOT assume `/root`."
2. **Monitor Churn**: Watch if `read` loops lead to successful tasks or timeouts.

# Proposed Update to `system-design.md`

Add a new section under "Runtime Environment":

### Filesystem & Workspace
- **Root**: `/app` is the project root.
- **Workspace**: Each agent has a dedicated workspace at `/app/agents/{agent}/workspace`.
- **Constraint**: Agents should use relative paths (`agents/bob/workspace/todo.md`) or absolute paths starting with `/app`.
- **Prohibited**: Do not attempt to access `/root`, `/home`, or `/tmp` outside `/app`.
