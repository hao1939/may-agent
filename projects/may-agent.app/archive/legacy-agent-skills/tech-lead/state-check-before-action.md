---
name: state-check-before-action
description: >
  Before any state-mutating operation (edit, write, destructive bash), verify
  that preconditions hold using read-only tool calls. Prevents the #1 source
  of wasted tool calls: edit() match failures from stale mental models of file
  state. Targets FM-1.1 (PATH_CONFUSION), FM-2.6 (REASONING_ACTION_MISMATCH),
  and cascading edit failures.
version: 1.0.0
owner: optimizer
---

# State-Check-Before-Action (SCBA): Verify Before You Mutate

## When to Apply

Apply this skill **before every state-mutating operation** — any tool call that
changes files, configuration, or system state. Specific triggers:

- **Before `edit()`**: You are about to edit a file and need the `oldText` to
  match exactly. If you haven't read that file *in this session*, your mental
  model of its contents is a guess.
- **Before `write()`**: You are about to overwrite a file. If you haven't
  confirmed the path exists (or doesn't exist), you may clobber the wrong file
  or write to the wrong location.
- **Before a destructive `bash` command** (`rm`, `mv`, `sed -i`, `git reset`):
  You are about to change something irreversibly. If the path or state is wrong,
  the damage may be unrecoverable.
- **Before referencing a path you haven't seen in this session's tool output**:
  Paths drift between sessions — files get moved, renamed, or deleted. A path
  that worked yesterday may 404 today.
- **Before making a factual claim about file contents**: If you're about to say
  "file X contains Y" without having tool output proving it, you're guessing.

**Do NOT apply** when:
- You *just* read the file in the previous tool call (state is fresh)
- You are creating a brand-new file that doesn't exist yet (`write()` to a new path)
- The operation is read-only (`read`, `grep`, `ls`, `find`) — these are already
  verification operations, not mutations

## Why This Matters

LLMs maintain an internal model of filesystem state, but that model **drifts from
reality after every mutation**. When you `edit()` a file, the file's content changes —
but your next `edit()` often uses `oldText` based on your *pre-edit* mental model,
not the actual post-edit content. The result: match failures that cascade.

The data is stark. From analysis of 15+ production sessions:

| Behavior | Edit failure rate | Tool calls per deliverable |
|----------|------------------|---------------------------|
| SCBA present (read before edit) | 0–5% | 8–15 |
| SCBA absent (edit without reading) | 50–97% | 30–100+ |

The worst case: an agent attempted 92 edits with only 10 reads. **89 of 92 edits
failed** (96.7% failure rate), wasting ~200 tool calls. A single `read()` between
each edit batch would have prevented every failure.

SCBA is not about being cautious — it's about being *efficient*. A `read()` or
`grep` costs one tool call. A failed `edit()` plus retry costs two. At scale, the
math is overwhelming: spend 1 to save 2+.

## Steps

### Step 1: IDENTIFY what your next action depends on

Before performing a mutation, pause and ask: *What must be true for this to succeed?*

| Mutation | Preconditions to verify |
|----------|------------------------|
| `edit(path, oldText, newText)` | (1) `path` exists, (2) file contains `oldText` exactly |
| `write(path, content)` | (1) Parent directory exists, (2) not accidentally overwriting important content |
| `bash("sed -i ...")` | (1) Target file exists, (2) pattern to match is present |
| `bash("rm ...")` | (1) Target exists, (2) it's the right file (not a similarly-named one) |
| Factual claim ("X contains Y") | (1) `grep` or `read` output in this session confirms it |

The preconditions are almost always about **paths** and **contents**. Get those
right and the mutation will succeed.

### Step 2: VERIFY each precondition with a read-only tool call

Use the lightest verification that confirms the precondition. Three levels,
from cheapest to most thorough:

**L1 — Path Verification** (answers: "Does this exist? Where is it?")
```bash
ls <parent-directory>/              # See what's actually there
find . -name "<filename>" -type f   # Find the real path if unsure
test -f <path> && echo EXISTS       # Quick existence check
```
Use L1 when you're referencing a path from memory, from instructions, or from
a previous session. Paths are the #1 source of false assumptions.

**L2 — Content Verification** (answers: "Does the file contain what I think?")
```bash
grep -n "<expected_text>" <path>    # Find the exact line with the text
read(path, offset=N, limit=M)      # See the actual content around line N
head -20 <path>                     # Quick look at the file structure
```
Use L2 before every `edit()`. Your `oldText` must match the file *exactly* —
copy it from the tool output, don't type it from memory.

**L3 — Context Verification** (answers: "Is the surrounding state correct?")
```bash
grep -rn "<symbol>" <directory>/    # Cross-file check: is this used elsewhere?
wc -l <path>                        # Sanity check: is the file the size I expect?
cat <path> | head -5                # Does the file format match expectations?
```
Use L3 before complex mutations that depend on relationships between files —
e.g., renaming a function requires checking all callers, not just the definition.

### Step 3: PROCEED only when preconditions are confirmed

After verification:

- **All preconditions hold** → Execute the mutation. Use the exact text from
  your verification output as `oldText` for `edit()`. Don't paraphrase it.
- **A precondition fails** → Do NOT attempt the mutation. Instead:
  - Wrong path → use `find`/`ls` to discover the correct one
  - Content doesn't match → `read()` the actual content, adjust your plan
  - File doesn't exist → decide if you need to create it or if your plan is wrong

The key discipline: **never optimistically attempt a mutation hoping the
precondition is probably true.** The cost of checking is ~0; the cost of
guessing wrong is 2+ wasted tool calls plus potential cascading failures.

### Step 4: RE-VERIFY after sequences of mutations

After performing 2+ edits to the same file in sequence, re-read the file
before the next edit. Each mutation changes the file, and your mental model
of the cumulative state becomes increasingly stale.

The pattern:
```
read(file)       → see actual content, copy exact text
edit(file, ...)  → first edit succeeds (oldText from read)
read(file)       → re-ground: see post-edit content     ← THIS IS THE KEY STEP
edit(file, ...)  → second edit succeeds (oldText from re-read)
```

Without the re-read between edits, the second edit uses `oldText` based on
your *mental model* of what the file looks like after the first edit — but
you might have the line numbers wrong, the indentation wrong, or there might
be whitespace differences. The re-read eliminates all of these risks.

**Exception**: If your edits are to completely different, non-overlapping
sections of a large file and you used line-specific `read(offset, limit)` for
each section, you can skip the intermediate re-read. But if in doubt, re-read.

## Assertions

1. Before every `edit()` call, the agent has a `read()`, `grep`, or `bash`
   output from *this session* that contains the exact `oldText` being used —
   the oldText is copied from tool output, not composed from memory.

2. Before referencing a file path not yet seen in this session's tool output,
   the agent runs `ls`, `find`, or another path-discovery command to confirm
   the path exists.

3. When making a factual claim about what a file contains (e.g., "the config
   has port 8080"), the agent has `grep` or `read` output in the current
   session that shows that content — claims are backed by evidence, not memory.

4. After performing 2+ sequential edits to the same file, the agent re-reads
   the file (or the relevant section) before the next edit to re-ground its
   mental model of the file's current state.

5. The agent never attempts an `edit()` call that fails with "Found 0
   occurrences" and then retries with a different guess at `oldText` without
   first reading the file — every retry after a match failure is preceded by
   a fresh `read()` of the target file.

## Anti-Patterns

### AP-1: Stale Mental Model ("I remember what's in that file")
**Pattern**: Agent edited a file 5 turns ago, now wants to edit it again. Instead
of re-reading, it composes `oldText` from its memory of what the file looked like
after the earlier edit. The `oldText` is slightly wrong — maybe a space is off,
maybe the earlier edit shifted line numbers. Edit fails with "Found 0 occurrences."

**Why it happens**: The agent trusts its internal state tracking. But LLMs are
approximate — they don't maintain exact character-level representations of files
after mutations. Small discrepancies (whitespace, newlines, indentation) accumulate.

**Cost**: Each failed edit wastes a tool call, and the retry often fails too
(because the agent adjusts its guess without re-reading). Bob's 89/92 failure
chain is the extreme case.

**Fix**: Re-read before re-editing. One `read()` call saves 2+ failed `edit()`
calls. Always copy `oldText` from fresh tool output.

### AP-2: Path Assumption ("The file is obviously at X")
**Pattern**: Agent knows a file should exist at a certain path based on conventions,
instructions, or prior sessions. Instead of verifying, it directly calls
`edit(path, ...)` or `read(path)`. The path is wrong — file was moved, renamed,
or never existed at that location.

**Why it happens**: Agents learn path patterns (e.g., `agents/<name>/workspace/`)
and generalize them. But specific filenames vary, and files move between sessions.

**Cost**: The failed operation triggers an error, then the agent spends 1-2 turns
diagnosing the wrong path before discovering the correct one. Total waste: 2-3
tool calls and analysis overhead.

**Fix**: L1 verification: `ls <directory>/` before accessing a specific file in it.
Takes one tool call, prevents the entire failure chain.

### AP-3: Optimistic Edit Chain ("My edits are simple, they'll all work")
**Pattern**: Agent plans a sequence of 5+ edits to a file. It performs them all
in rapid succession without re-reading between them. The first edit succeeds, but
subsequent edits fail because the file's content shifted (line numbers changed,
surrounding context moved). The agent then spends 10+ tool calls debugging match
failures.

**Why it happens**: Re-reading between edits feels slow. The agent optimizes for
speed, reasoning that if the first edit worked, the others will too.

**Cost**: Catastrophic when it fails. A 5-edit chain with no re-reads can produce
4 failures (all after the first). With re-reads: 5 reads + 5 edits = 10 calls.
Without re-reads: 1 edit + 4 failures + 4 re-reads + 4 retries = 13 calls. The
"fast" approach is slower.

**Fix**: Step 4 — re-read after every 1-2 edits. The slight overhead per-edit is
vastly cheaper than debugging cascading match failures.
