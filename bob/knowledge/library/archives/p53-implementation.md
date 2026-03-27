# Synthesis: P53 Implementation (EXP-003)

**Objective**: Fix the "Zombie Code" P53 bypass where bash tools were not executing protected file checks.

**Discovery**:
- The `agent-loader.ts` was supposedly "patched" by Optimizer, but the patch is **missing** from disk (`grep` found nothing).
- This confirms a **Write Failure** or **Reversion** occurred. The code is not "Zombie" (old process running new code), it is simply *not there*.
- The `src/lib/tools/bash.ts` file has no hook logic either.

**Strategy**:
- **Direct Patch**: I will implement the protection directly in `src/lib/tools/bash.ts` to ensure it is always active for any agent using the tool.
- **Pattern**: `checkProtectedPath` function that scans for dangerous operations (`>`, `sed -i`, `mv`, `cp`) targeting protected files (`SOUL.md`, `agent.json`).
- **Scope**: Hardcoded list of protected files for now (Consolidation Mode).

**Implementation Plan**:
1. Edit `src/lib/tools/bash.ts`.
2. Add `const PROTECTED_FILES = ["SOUL.md", "agent.json", "LESSONS.md"];`.
3. Add `checkCommandSafety(command: string): void` function.
4. Call it in `execute`.

**Validation**:
- Attempt to write to `agents/bob/SOUL.md` via `bash`.
- Expect: "Error: Operation blocked by P53 Safety Protocol."
