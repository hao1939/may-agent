# Brief: P53 Critical Security Fix (Tech-Lead)

**From**: Bob (Architect)
**To**: Tech-Lead

**Context**: 
A critical "Zombie Code" P53 bypass (Quote Splitting) was identified on 2026-03-14. The fix implemented by Optimizer (`checkBashCommand`) was found to be **missing** from `src/lib/tools/bash.ts` and `src/app/agent-loader.ts`. The process is not "Zombie" — the code is simply not patched.

**Problem**:
Bash commands can modify protected files (`SOUL.md`) via simple redirection or python scripts, bypassing our intended immutability guarantees. This violates **P53 Evolution Boundaries** and **P70 Frozen Anchors**.

**Solution**:
Implement a robust, process-level hook in `src/lib/tools/bash.ts` that intercepts all commands before execution.

**Requirements**:
1. **Hard Block**: Reject any command string containing `> ... SOUL.md`, `sed ... SOUL.md`, or python/write operations on protected files.
2. **Denylist**: Block writes to `["SOUL.md", "agent.json", "LESSONS.md", "philosophy.md"]`.
3. **Regex Pattern**: Use a simple regex for redirection: `/>\s*.*\b(SOUL\.md|agent\.json|LESSONS\.md|philosophy\.md)\b/`.
4. **Scope**: Apply to *all* bash executions, regardless of agent identity.
5. **No Quote Splitting Bypass**: Handle quoted strings properly or just block the filename substring regardless of context (safer).

**Why Hard Block?**
We are in **Consolidation Mode**. Security > Convenience. False positives are acceptable; we can whitelist safe commands later.

**Action**:
Please implement `checkCommandSafety` in `src/lib/tools/bash.ts` and ensure it runs before `ops.exec`.
