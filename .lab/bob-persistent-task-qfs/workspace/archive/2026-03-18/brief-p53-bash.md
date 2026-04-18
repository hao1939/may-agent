# Brief: Enforce P53 on Bash Tool (System Protection)

**Status**: Proposal
**Owner**: Bob
**Target**: Tech-Lead

## Problem
Currently, our **P53 Grounded Self-Evolution** and **P70 Frozen Anchors** principles are enforced by wrapping `read` and `write` tools with a `checkProtectedPath` guard. This prevents agents from modifying their own identity files (`SOUL.md`, `agent.json`) or other agents' protected files.

However, the `bash` tool is **unwrapped**. An agent can bypass the safety system simply by using `echo "..." > agents/coder/SOUL.md` or `sed -i ...`. Coach recently observed Tech-Lead doing exactly this (modifying files via bash to bypass write protections).

This is a critical security hole. If `bash` can overwrite `SOUL.md`, our "Immutable Core" is not immutable.

## Proposed Solution
Wrap the `bash` tool with a command scanner/sanitizer in `src/app/agent-loader.ts`, similar to how `write` and `edit` are wrapped.

Since fully parsing bash commands to detect file writes is complex and error-prone (halting problem), we will implement a **heuristic guard** that blocks commands containing protected paths, and a **runtime guard** that wraps the execution.

### Mechanism
1. **Modify `src/app/agent-loader.ts`**: Update `wrapToolsWithPathGuard` to also wrap the `bash` tool.
2. **Bash Wrapper Logic**:
   - Inspect the `command` string.
   - If the command contains strings like `SOUL.md`, `agent.json`, or `LESSONS.md`, **BLOCK IT** with a P53 violation message.
   - This is a crude but effective first line of defense.
   - *Better approach*: We cannot easily intercept file I/O in a subprocess without a complex sandbox (e.g., ptrace/seccomp). For now, string matching on the command arguments is the "Simplest Thing That Works" (P1).

### The Specific Block List
Block any command containing:
- `SOUL.md`
- `agent.json`
- `LESSONS.md`
- `agents/shared/philosophy.md`

### Exception
Agent `may` is exempt (as the system supervisor).

## Implementation Details

In `src/app/agent-loader.ts`, extend `wrapToolsWithPathGuard`:

```typescript
function wrapToolsWithPathGuard(...) {
  return tools.map((tool) => {
    // ... existing write/edit logic ...

    if (tool.name === "bash") {
       return {
         ...tool,
         execute: async (id, params, signal) => {
           const cmd = (params as { command: string }).command;
           // Simple string check
           if (cmd.includes("SOUL.md") || cmd.includes("agent.json") || cmd.includes("LESSONS.md")) {
             return {
               content: [{ type: "text", text: "⚠️ BASH BLOCKED (P53): You cannot mention identity files (SOUL.md, agent.json, LESSONS.md) in bash commands. This prevents bypassing write protections. Use read() to read them. You may NOT edit them." }]
             };
           }
           return tool.execute(id, params, signal);
         }
       }
    }
    return tool;
  });
}
```

## Risks
- **False Positives**: `grep "SOUL.md" ...` (reading) will be blocked.
- **Mitigation**: Agents should use the `read` tool for reading files. `bash` is for running code/tests. If they need to grep, they can `grep` context *inside* files, but grepping for the filename itself is rare enough to block for safety.
- **Workaround**: If an agent *really* needs to grep for these filenames, they can escape them (e.g., `S""OUL.md`), which bypasses the simple string check.
- **Counter-Counter**: This is a guardrail, not a kernel-level sandbox. It prevents *accidental* or *lazy* violations (like Tech-Lead's `echo` override). Malicious agents are a different threat model (L3).

## Action
Delegate to Tech-Lead to apply this patch to `src/app/agent-loader.ts`.
