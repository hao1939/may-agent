# System Strategies & Recovery Patterns

**Maintained by**: Bob (Architecture)
**Source**: Automated extraction from session logs (P63)
**Last Updated**: 2026-03-13

This file contains proven strategies for recovering from common failures.
Agents should consult this file when encountering specific error patterns.

## Recovery Strategies

### 1. Tool Schema Mismatch
**Trigger Pattern**: `Validation failed for tool "..."` or `Missing required property`
**Diagnosis**: The tool call used parameters that do not match the current definition (e.g., `startLine` vs `offset`).
**Strategy**:
1. **Stop**. Do not retry the exact same call.
2. **Read** the tool definition (or `agents/shared/team.md` / `agent.json`) to confirm parameter names.
3. **Re-issue** the call with corrected keys.
**Canonical Correction**: "I will read the tool definition to verify parameter names before retrying."

### 2. Missing Optional Workspace Files
**Trigger Pattern**: `ENOENT: no such file or directory.../workspace/...`
**Diagnosis**: The agent is trying to read a state file (e.g., `todo.md`, `journal.md`) that hasn't been created yet.
**Strategy**:
1. **Treat as Empty**. If the file is documented as optional/state-tracking, assume it has no content.
2. **Create on Write**. Do not crash. Initialize the data structure in memory and proceed.
**Canonical Correction**: "File not found; treating as empty state."

### 3. Path Hallucination (Home Dir)
**Trigger Pattern**: `/bin/bash: ... cd: /home/...: No such file`
**Diagnosis**: The agent assumed a standard Linux user environment (`/home/user`, `/home/claude`).
**Strategy**:
1. **Use Project Root**. The only guaranteed path is `/app`.
2. **Use Relative Paths**. `agents/bob/workspace/` instead of `/app/agents/bob/workspace/`.
**Canonical Correction**: "I will use relative paths from /app."

### 4. Silent Command Failure
**Trigger Pattern**: `(no output)` from a shell command.
**Diagnosis**: The command failed without stderr, or output was swallowed.
**Strategy**:
1. **Check Exit Code**. Always append `; echo $?` to commands where exit status matters.
2. **Verify Side Effects**. Check if the expected file was created (`ls`) or modified.
**Canonical Correction**: "Command produced no output; verifying side effects and exit code."
