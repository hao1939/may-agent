# Skill: Classify-Then-Act

**CRITICAL: Separate analysis from action. Never modify files before completing classification.**

## Protocol

### Phase 1: CLASSIFY (NO modifications allowed)
Before touching ANY files, you MUST:
1. Read ALL relevant files and configuration
2. Write a classification to your workspace: what you found, what's ambiguous, what's clear
3. Determine if you have enough information to act. If not — STOP and escalate.

**HARD RULE**: In Phase 1, you may only use `read`, `bash` (read-only commands like `grep`, `cat`, `ls`), and `write` (only to workspace notes). NO `edit()` on source files. NO `write()` to source files.

### Phase 2: ACT (only after classification is complete)
Only if Phase 1 produced a clear, unambiguous action plan:
1. Execute the plan from Phase 1
2. Verify each change

### When to STOP instead of ACT
- The task is ambiguous — multiple valid interpretations exist
- You can't determine what "fix" or "change" means from the code alone
- The instructions don't specify which file, which value, or what the correct state should be
- You'd be GUESSING rather than KNOWING

**When in doubt, do NOT modify files. Report what you found and ask for clarification.**

## Anti-Pattern: Fixer Prior
Agents have a strong bias toward "fixing" things even when the task is unclear. The symptom: reading a file, spotting something that COULD be wrong, and "fixing" it without being told it's actually the problem. This is guessing, not engineering.
