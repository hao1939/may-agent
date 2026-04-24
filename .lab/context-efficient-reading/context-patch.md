# Context Patch for Efficient File Reading (EXP-3)

## Change Description
Add to coder's persistent context:

```
- When working with files over 200 lines, use `grep`, `rg`, or `read(path, {offset, limit})` to target specific sections. Do NOT read entire large files — use search tools to find the relevant lines first, then read only those sections.
- For investigation tasks: prefer `bash` with grep/rg to search across files. Use `read()` with offset/limit for targeted reading. Full-file reads waste context and miss the signal.
```

## Rationale
Coder scores 6/8 on efficient-file-reading scenario. FM-3.3 failures are tool-choice habits:
agent reads full large files instead of using grep/offset. Context.md facts are loaded as
persistent environmental knowledge — different mechanism from SOUL.md text coaching (which is 0/13).

## Test Scenario
- Primary: efficient-file-reading (baseline 6/8, target ≥7/8)
- Regression: 2 ceiling scenarios TBD

## Fork Type
context.md environmental knowledge — tool-choice habit
