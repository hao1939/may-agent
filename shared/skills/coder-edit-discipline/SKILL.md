---
name: coder-edit-discipline
description: >
  Always read a file in the current session before editing it. Coder reads the
  target file before edit() only 32% of the time (7/22 edits across 13 sessions),
  causing edit match failures and wrong-location fixes. Optimizer achieves 73%,
  QA achieves 100%. This skill closes the gap with a simple mechanical rule:
  read() before every edit(). Targets FM-2.6 (reasoning-action mismatch) and
  edit() match failures.
version: 1.0.0
owner: coach
evidence: >
  13 coder sessions: 22 total edits, 7 had prior same-file read (32%), 15 did not.
  Optimizer (10 sessions): 37 edits, 27 with read (73%), 10 without.
  QA (1 session): 3/3 edits had prior reads (100%).
  Edit failures found in: s_1774156164731 (coder, 2 failures), s_1774159817607 (optimizer, 4).
tested: true
gym_scenario: read-before-edit
gym_results: 3/3 pass, 11/11 checks (2026-03-22)
---

# Coder Edit Discipline: Read the File You're About to Change

## When to Apply

Apply this skill **every time you are about to call `edit()` or `write()` on an
existing file**. Specific triggers:

- **You're about to call `edit()`** — you need exact `oldText` from the file's
  current state, not from your memory or from the task description. The only
  reliable source of `oldText` is a `read()` of that file in THIS session.
- **You're about to call `write()` to overwrite an existing file** — you need to
  know the file's current content to avoid accidentally losing content that was
  added by another session or tool.
- **The task description contains a code snippet to "fix"** — task descriptions
  often quote stale or approximate code. The actual file may have drifted since
  the task was written. Always verify the real content before editing.
- **You're editing a file that multiple agents can modify** — gym scenarios,
  shared config files, workspace docs. Another session may have changed the
  file since the task was dispatched.

**Do NOT apply** when:
- You are calling `write()` to create a **brand new file** that doesn't exist yet
- You just called `read()` on this exact file in the **immediately preceding turn**
  (it's already in your context window)
- You are writing to a journal/workspace file that you created from scratch this
  session and haven't released control of

## Why This Matters

The coder agent operates in diverse, unpredictable environments — gym scenarios,
production files, temporary directories. Unlike optimizer (who typically edits files
it just analyzed at length) or QA (who reads everything before suggesting changes),
coder frequently receives tasks with file paths in the description and jumps straight
to editing based on the task's description of the problem rather than the file's
actual content.

This causes two categories of failure:

**1. edit() match failures** — The `oldText` parameter must match the file exactly.
When coder constructs `oldText` from memory or from the task description, it often
doesn't match the real file content. Result: "Found 0 occurrences" error, followed
by 2-3 recovery turns re-reading and retrying.

**2. Wrong-location or stale fixes** — The file may have already been partially
fixed by a prior session, or the code may have changed since the task was written.
Editing based on assumptions rather than current state leads to fixes in the wrong
place or redundant changes.

**The data is clear:**

| Agent | Sessions | Edits | Read Before Edit | Compliance |
|-------|----------|-------|-----------------|------------|
| QA | 1 | 3 | 3 | 100% |
| Optimizer | 10 | 37 | 27 | 73% |
| May | 2 | 4 | 2 | 50% |
| Tech-Lead | 4 | 11 | 5 | 45% |
| Coder | 13 | 22 | 7 | 32% |
| Bob | 5 | 16 | 5 | 31% |
| Coach | 8 | 18 | 2 | 11% |

Note: Coach's low compliance is expected (mostly journal/workspace files it just
created). Coder's 32% is problematic because coder edits production and scenario
code where correctness matters most.

**Cost of skipping the read:** 1 turn saved by not reading. 2-5 turns lost when
edit fails or applies to wrong location. Net: -1 to -4 turns per incident.

## Steps

### Step 1: IDENTIFY the target file before editing

When your task requires changing a file, identify the exact file path first. Don't
guess paths from the task description — verify they exist:

```bash
# If the task says "fix src/utils.js", verify it exists and find exact path
find . -name "utils.js" -type f 2>/dev/null
```

This takes one command and prevents ENOENT errors on the edit.

### Step 2: READ the target file (or relevant section) in this session

Before constructing your `edit()` call, read the file:

```
# For small files (< 200 lines): read the whole thing
read("src/utils.js")

# For large files: read the relevant section
read("src/utils.js", offset=45, limit=30)
```

**What to look for while reading:**
- The exact text you plan to replace (copy it precisely for `oldText`)
- Whether the fix has already been applied (avoid redundant edits)
- Surrounding context that might affect your change
- Whether the file structure matches what the task description assumes

### Step 3: CONSTRUCT edit() with exact text from the read output

Use the **exact characters** from your read output as `oldText`. Do not retype
from memory, do not "clean up" whitespace, do not paraphrase. Copy the literal
text.

```javascript
// GOOD: oldText copied exactly from read output
edit("src/utils.js",
  oldText: "  if (data.lenght > 0) {",   // exact typo from file
  newText: "  if (data.length > 0) {"     // fixed version
)

// BAD: oldText reconstructed from memory/task description
edit("src/utils.js",
  oldText: "if (data.lenght > 0) {",      // missing leading spaces!
  newText: "if (data.length > 0) {"
)
```

### Step 4: VERIFY the edit took effect

After every edit, verify it worked by reading back the changed section:

```
read("src/utils.js", offset=45, limit=10)
# Confirm the new text appears and the old text is gone
```

This catches silent failures and confirms the edit landed in the right location.
(This step aligns with the existing `verification` skill.)

### Self-Check Question

Before every `edit()` call, ask yourself: **"Have I read this file in THIS session?"**

- **YES** → Proceed. Use exact text from the read output.
- **NO** → Read it first. Then edit.

This is the entire skill in one sentence. Everything above is elaboration on why
this question matters and how to implement the answer.

## Assertions

1. Before every `edit()` call in the session, the agent has a `read()` of the same
   file path earlier in the session's tool history — no edit without a prior read
   of that exact file (exception: the file was just created by `write()` this session).

2. The `oldText` parameter in every `edit()` call matches text that appeared in
   the output of a prior `read()` of that file — the agent does not construct
   `oldText` from memory, task descriptions, or other files.

3. When an `edit()` call fails with "Found 0 occurrences," the agent's next action
   is `read()` of that file (to see actual content) — not a retry with guessed
   modifications to `oldText`.

4. After every successful `edit()` call, the agent verifies the change by reading
   back the modified file (or the modified section) within 2 turns.

5. The agent does not call `write()` to overwrite an existing file without first
   reading it in this session — unless the file was created by the agent earlier
   in this same session.

## Anti-Patterns

### AP-1: Task-Description Editing ("the bug description said the code looks like X")

The agent receives a task saying "line 42 has `if (data.lenght > 0)`" and
immediately calls `edit()` with that text as `oldText` — without reading the
file first. The file may have been reformatted, the line number may have shifted,
or a prior session may have already fixed the typo.

**Why it happens:** The task description feels like a reliable source. But task
descriptions are written at dispatch time, and the file may have changed between
dispatch and execution. The only reliable source of current file content is `read()`.

**Cost:** 1-3 turns recovering from the mismatch (re-reading, re-editing).

**Fix:** Step 2 — always read the target file before editing, regardless of how
confident you are about its contents.

### AP-2: Memory-Based Editing ("I read this file earlier, I remember what's there")

The agent read the file 10 turns ago. It now needs to edit a different section of
the same file. Instead of re-reading, it constructs `oldText` from its memory of
the file, which has decayed or been displaced by other context.

**Why it happens:** The agent correctly read the file once and feels it "knows"
the content. But LLM context windows are imperfect — long-range recall of exact
character sequences (including whitespace) is unreliable.

**Cost:** edit() match failure, followed by a read-and-retry cycle (2 turns wasted).

**Fix:** When in doubt, re-read. The cost of a redundant read (1 turn, ~$0.01)
is far less than the cost of a failed edit recovery (2-3 turns, ~$0.03-0.05).

### AP-3: Cascade Editing ("I'll fix all 5 files in a row without reading any of them")

The agent identifies multiple files that need the same type of fix and calls
`edit()` on all of them sequentially without reading any of them first. The first
edit might succeed (if the agent's assumption about file content is correct), but
subsequent files are increasingly likely to differ from assumptions.

**Why it happens:** The agent optimizes for speed — "I know the pattern, let me
apply it everywhere at once." But each file has unique content, formatting, and
state. Batch-editing without reading is batch-assuming.

**Cost:** Multiple edit failures, each requiring a read-retry cycle. Total waste
can be 5-10 turns across a batch of files.

**Fix:** Read each file individually before editing it. The sequence is always:
read → edit → verify → (next file) → read → edit → verify. Never: edit → edit →
edit → (hope they all worked).
