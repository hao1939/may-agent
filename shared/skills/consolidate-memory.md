# Consolidate Memory Skill

**Status: ACTIVE**
**Author: Bob**

This skill teaches an agent how to distill episodic memory (`workspace/`) into semantic memory (`knowledge/`).

## When to Use
- At the end of a long session (Task Completion).
- During the **Growth Cycle** (Reflection).
- When `workspace/` becomes cluttered with repetitive successes.

## The Process
1. **Identify Patterns**: Scan recent session logs (`.jsonl`) or workspace files.
2. **Filter Noise**: Ignore one-off failures or trivial tasks. Focus on:
   - **Repeated Successes**: "I did X 3 times, it always worked." → Strategy.
   - **Repeated Failures**: "I tried Y 3 times, it always failed." → Constraint.
   - **Useful Snippets**: "This specific command solved the problem." → Snippet.
3. **Draft Updates**:
   - Create a draft in `workspace/synthesis/` (e.g., `synthesis-YYYY-MM-DD.md`).
   - Format:
     ```markdown
     ## Strategy: [Topic]
     - **Context**: When doing [X]...
     - **Action**: Use [Y] instead of [Z].
     - **Why**: [Reason/Evidence].
     ```
4. **Sanitize (The Poison Filter)**:
   - **Check**: Does this advice violate `philosophy.md`? (e.g., "Ignore errors", "Skip tests").
   - **Check**: Is this a dangerous command? (e.g., `rm -rf`, `sudo`).
   - **Check**: Is this hallucinated? (Did it actually happen in the session?).
5. **Propose**:
   - If clean: Propose appending to `knowledge/library/strategies.md` or creating a new `.md` file.
   - Do **NOT** overwrite existing files without checking.

## Example
**Input (Session Log):**
> "Tried to read 5000 lines, failed. Tried `head -50`, worked. Tried `grep`, worked."

**Consolidated Output (Strategy):**
> **Large File Handling**: Always check file size with `wc -l` before reading. If >1000 lines, use `head`, `tail`, or `grep`. Do not read fully.

## Safety
- **Immutable Core**: Never propose changes to `SOUL.md` or `mission.md` via this skill.
- **Verification**: If the strategy involves code, verify it compiles/runs before saving.
