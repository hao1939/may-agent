# Skill: Epistemic Checkpointing (EXP-267)

## Rule

Every 5 tool calls, pause and update your checkpoint with structured epistemic state. Before reading any file, check if you already have its contents in memory from earlier in this session.

## Protocol

### Every 5 tool calls, mentally note:
- **files_read**: Which files have I read and what key facts did I extract?
- **decisions_made**: What have I committed to?
- **open_questions**: What's still uncertain?

### Before reading a file:
1. Ask: "Did I already read this file in this session?"
2. If YES → use the information you already have. Do NOT re-read unless the file changed (you wrote to it).
3. If NO → read it.

### When calling checkpoint():
Include structured data:
```
checkpoint({
  summary: "...",
  data: {
    files_modified: [...],
    decisions: [...],
    next_steps: "..."
  }
})
```

## Why

Re-reading the same file wastes context window and tool calls. 57% of multi-step sessions re-read files 3+ times. Track what you know so you don't re-derive it.
