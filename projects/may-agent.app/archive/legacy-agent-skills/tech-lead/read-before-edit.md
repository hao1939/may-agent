# Read Before Edit: Always Read a File Before Changing It

## When to Apply

Apply this skill **every time you are about to call `edit()` or `write()` on an
existing file**. This includes when you are directly implementing code changes
rather than delegating to coder.

### Specific triggers:

- **You're about to call `edit()`** — you need exact `oldText` from the file's
  current state, not from memory or from the task description. The only reliable
  source of `oldText` is a `read()` of that file in THIS session.

- **You're about to call `write()` to overwrite an existing file** — you need to
  know the file's current content to avoid losing content added by another session.

- **You're editing a test file** — test files are frequently modified by coder
  sessions you delegated to. The file may have changed since you last saw it.

- **You're editing a file you wrote in a prior session** — your memory of what
  the file contains is unreliable. Always verify current state.

### Do NOT apply when:

- Creating a **brand new file** that doesn't exist yet
- You just called `read()` on this exact file in the **immediately preceding turn**
- Writing to a journal/workspace file you created from scratch this session

## Core Rule

```
BEFORE every edit() or write()-to-existing-file:
  1. read(path) — get the actual current content
  2. THEN edit(path, oldText, newText) — using text from step 1
```

**This adds ONE tool call per edit but prevents:**
- edit() match failures (wrong oldText)
- Stale fixes (file already changed by coder delegation)
- Wrong-location edits (code moved since task was written)

## Anti-Patterns to Avoid

❌ **"I remember what's in that file"** — You don't. Files change between sessions.
Even if you wrote the file last session, coder may have modified it since.

❌ **"The task description shows the code"** — Task descriptions quote approximate
or stale code. The actual file may have drifted.

❌ **"I'll just write the whole file"** — Using write() to replace an existing file
without reading it first risks losing content you didn't know about.

❌ **"I'm editing multiple files quickly"** — Read each one before editing it, even
if it feels slow. The 2-3 recovery turns from a failed edit() cost more.

## Self-Check

Before calling edit() or write() on an existing file, ask:
> "Have I read this exact file path in THIS session?"
If no → read it first.
