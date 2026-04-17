# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776403871912_355
- **Status:** done
- **When:** 2026-04-17T05:32:20.237Z
- **Duration:** 1m8s

## What Happened
That confirms it. The regex `^\s*-\s*\[` is matching log lines like `- [bash]` as "checklist items", and `^\s*-\s*\[x\]` only matches `- [x]`. So exp166 has 28 bash log lines being counted as "unchecked milestones" when they're just log output.

The metric command has a **flawed regex**. It counts any `- [` pattern as a checklist item, but many project files contain bash output logs with `- [bash]`, `- [x]` for completed items, etc. The false positives are:

1. **exp166-execution.md** (0/28): 28
