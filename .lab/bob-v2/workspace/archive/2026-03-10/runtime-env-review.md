
## Design Review: Runtime Environment Standardization (2026-03-09)

### Problem
Ephemeral agents consistently fail by attempting to access `/root/workspace/todo.md` (which does not exist in the `/app` container environment). This triggers a "Lost Agent" pattern where they waste turns searching the filesystem (`find /`, `ls -R`).

### Evidence
- 10+ recent failures in session logs (`s_1773032730225_178`, etc.).
- Recurring `read(fail)` -> `exec(find)` sequence.

### Proposed Fix
1. **Standardize**: Define `/app` as the project root and `agents/{agent}/workspace` as the workspace.
2. **Inject**: Update the system prompt (via `launcher.ts`) to explicitly state the CWD and workspace path.
3. **Constrain**: Update `CONVENTIONS.md` to prohibit `/root` and `/home` access.

### Philosophy Check
- **Minimalism (P41)**: Reduces wasted tokens on filesystem exploration.
- **Determinism (P14)**: Makes agent environment predictable.
- **Supply Chain Trust (P38)**: Reduces attack surface by locking down paths.

### Verdict
✅ APPROVED. This is a structural fix to a recurring operational failure.

### Implementation Tasks
- [x] **Data Integrity (Poison Path Protection)** — Structural guardrail to prevent "Blind Overwrite". Truncated reads must poison the file path, blocking future write() calls in the same session.
- [ ] Sanitize PATH variable to remove non-essential directories before agent launch
- [ ] Update `agents/shared/system-design.md` with "Filesystem & Workspace" section.
- [ ] Update `agents/CONVENTIONS.md` with "Filesystem Standards".
- [ ] Update `src/launcher.ts` (or relevant prompt builder) to inject `CWD` and `WORKSPACE_ROOT`.
