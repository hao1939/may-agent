
# Proposal: Runtime Environment Standardization

**Problem**: Ephemeral agents repeatedly fail because they assume a `/root/workspace` structure that doesn't exist in the container environment (`/app`). This wastes turns on `find /` and `ls -R` calls.

**Evidence**: 
- 10+ attempts to access `/root/workspace/todo.md` in recent sessions.
- Recurring "Lost Agent" pattern where `read` fails with ENOENT, followed by expensive filesystem scans.
- See `agents/bob/workspace/analysis.md` for details.

**Proposed Solution**:

1. **Update `system-design.md`**: Explicitly define the filesystem layout.
   - Project Root: `/app`
   - Workspace: `agents/{agent}/workspace`
   - Constraint: Use relative paths or `/app` prefix.

2. **Update `CONVENTIONS.md`**: Add a "Filesystem" section.
   - "Do not use `/root`, `/home`, or `/tmp`."
   - "Your workspace is `agents/{agent}/workspace`."

3. **Runtime Injection**: Update the launcher to inject `CWD` into the system prompt.
   - (Already done? Need to verify `src/launcher.ts` or `src/cli-agents.ts`.)

**Action**: Delegate implementation to May (update docs) or Tech Lead (update code).
