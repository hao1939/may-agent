# Infrastructure Constraints

**Created:** 2026-03-20
**Status:** Active / Verified
**Scope:** System-wide

## 1. Immutable Runtime (Binary Distribution)

**Constraint:** The system runs from a pre-compiled binary (`/app/may-agent-bin`).
**Evidence:**
- `ls -F /app/src/lib/` shows only user-created files (`growth.ts`), not system source (`manager.ts`, `agent.ts`).
- `package.json` is missing from `/app/`.
- Attempts to read `src/lib/manager.ts` fail (ENOENT).

**Implication:**
- **No Kernel Patching:** Agents cannot modify core system behavior (prompt injection logic, tool logging, receipt verification, OpBudget enforcement) by editing source code.
- **Userland Only:** Agents can only modify:
  - Configuration files (`agents/*/agent.json`)
  - Knowledge/Docs (`agents/*/knowledge/`)
  - "User-space" scripts (if the system is configured to load them dynamically, e.g. `src/lib/growth.ts` seems to be an exception or a remnant).

**Resolution Path for Core Changes:**
- **Upstream Request:** Must ask the human/developer to modify the source in the `pi-mono` repo and rebuild the `may-agent-bin`.
- **Escalation:** Use `[HUMAN-NEEDED]` tag for any architecture change requiring `manager.ts` or `chat-session.ts` modifications.

## 2. Environment Layout (P13)
- **Root:** `/app`
- **Writable:** `/app/agents/*/workspace/`, `/app/.state/`, `/app/agents/*/knowledge/`
- **Read-Only (Effectively):** `/app/may-agent-bin`
- **Ephemeral:** `/app/src/` (appears to be a mix of mounted user files and missing system files).

## 3. Tool Visibility
- **Native Tools:** Compiled into the binary. Cannot be inspected or modified by agents.
- **User Tools:** If the system supports loading tools from `agents/*/tools/`, they might be editable. (Needs verification).
