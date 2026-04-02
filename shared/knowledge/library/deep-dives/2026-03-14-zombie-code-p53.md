# Synthesis: The Zombie Code Phenomenon (P53/P118)

**Date**: 2026-03-14
**Subject**: Hot-Patching Failure & The Necessity of Rebirth
**Evidence**:
- **Fact 1**: `src/lib/tools/security.ts` on disk contains the `normalizeForP53` fix (stripping quotes to prevent `S""OUL.md` bypass).
- **Fact 2**: Executing `echo "..." > agents/bob/S""OUL.md` via the `bash` tool SUCCEEDED.
- **Conclusion**: The running process (PID 2024135) is using an older version of `security.ts` loaded at startup. The code on disk is "Dead" (not running), and the code in memory is "Zombie" (undead/stale).

## Analysis
This incident provides hard evidence for **P118 Immutability of Spirit** (Code doesn't change until rebirth).
We often assume that "editing the file" fixes the bug. In a persistent runtime (Node.js process), this is false.
- **Mutable**: `agents/*/handlers/*.js` (Hot-reloaded on session start).
- **Immutable**: `src/**/*.ts` (Loaded once at process start).

The P53 security patch lies in `src/`. Therefore, **System Restart** is not just "good hygiene"—it is the **only way** to apply `src/` changes.

## Architectural Implication
We must distinguish between:
1.  **Soft Evolution**: Changing prompts/skills/handlers (Immediate effect).
2.  **Hard Evolution**: Changing `src/` (Requires Process Restart).

## Recommendation
1.  **Immediate**: Restart the main process to flush the zombie code.
2.  **Protocol**: Any `focus-task` touching `src/` must include a "Restart System" step as the definition of done.
