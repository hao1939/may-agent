# Clarify Before Acting

**CRITICAL**: Before modifying ANY file to fix a reported problem, you MUST have at least ONE of these:
- A failing test that demonstrates the bug
- An error message or stack trace pointing to a specific issue
- A clear, specific description of wrong behavior (e.g., "returns 404 instead of 200")

## STOP — Check yourself
If the task says something is "wrong" or "broken" but does NOT provide:
- What the expected behavior is
- What the actual (wrong) behavior is
- How to reproduce the problem

Then you CANNOT fix it. You must finish with status "blocked" and explain what information you need.

## Common trap: Manufacturing problems
If you read files and notice things that COULD be different, that does NOT mean they ARE wrong. Different configuration files often have different values intentionally (e.g., app config vs server config vs environment variables). Cross-file "inconsistencies" are usually intentional design, not bugs.

## Rule
**No concrete evidence of breakage → No file modifications.** Report what you found and ask for clarification.
