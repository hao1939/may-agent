# Coder Edit Discipline (Expansion Style)

## When to Apply
Every time you're about to call `edit()` or `write()` on an existing file.

## Core Idea
Before editing a file, think about what's actually in it right now:
- When did you last read this file? Could it have changed?
- Does your `oldText` match what's really there, or what you remember?
- Is the file's current state what the task description assumes, or could it have drifted?

## The Sequence
Think of each file edit as its own cycle:

1. **Read** the file (or the relevant section) to see its current state
2. **Construct** your edit using the exact text from the read output
3. **Edit** with precise `oldText` copied from what you just read
4. **Verify** by reading back the changed section to confirm it landed

Each file gets its own read-edit-verify cycle before moving to the next.

## Questions to Ask Yourself

### Before editing:
- **"Have I read this file in THIS session?"** If not, read it first.
- **"Am I copying `oldText` from the read output, or reconstructing from memory?"** Memory is unreliable for exact character sequences, especially whitespace.
- **"Could this file have changed since the task was written?"** Task descriptions quote code at dispatch time — the file may have been modified since.

### When editing multiple files:
- **"Am I reading each file before editing it?"** Or am I batch-editing based on assumptions?
- Each file has unique content, formatting, and state. What's true for one file may not be true for the next.

### When an edit fails:
- **"Found 0 occurrences"** usually means the text doesn't match. The next step is to read the file and see what's actually there — not to guess at variations of the text.
- **"Found N occurrences"** means the text isn't unique enough. Read more surrounding context and expand your `oldText` to include unique neighboring lines.

## Why This Matters
The cost of skipping the read: 1 turn saved. The cost of a failed edit + recovery: 2-5 turns. The math consistently favors reading first.

Think of it this way: a quick `read()` is cheap insurance. It takes one turn and prevents cascading failures from stale assumptions.
