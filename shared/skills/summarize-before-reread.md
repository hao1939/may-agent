# Skill: Summarize Before Reread

## Trigger
You are about to call `read()` on a file you already read earlier in this session.

## Action
STOP. Instead of re-reading:
1. Check if anything modified the file since you last read it (your own `edit()` or `write()` call, or a bash command that could have changed it).
2. If **nothing changed it** → quote the relevant section from memory. Do NOT re-read.
3. If **something changed it** (you edited it, ran a script that modifies it, etc.) → re-read is mandatory before finish(success). Proceed.

## Why This Matters
- Re-reading unchanged files wastes ~33% of tool calls in some agents (measured in EXP-850).
- Each unnecessary read costs tokens and time without adding information.
- Tool previews from `write()`/`edit()` help quick inspection, but they do not replace the required read-back before finish(success).

## Exceptions
- File is very large (>200 lines) and you only need a specific section you can't recall precisely.
- More than 20 tool calls have elapsed since you last read it (memory may have degraded).
- You're doing a final verification pass explicitly required by your workflow.

## Evidence
- EXP-850 (2025-05-05): Dev agent showed 33% read redundancy vs 13.8% system average.
- Root cause: agents re-read files "to be safe" even when nothing could have changed them.
