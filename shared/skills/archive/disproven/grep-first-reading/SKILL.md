---
name: grep-first-reading
description: >
  Search-then-read strategy for file access. Prevents wasted context by using
  grep/rg to locate relevant lines before reading, and offset/limit to read only
  what's needed. Targets the #1 source of context bloat: full-file reads of large
  files when only a small section is relevant.
version: 1.0.0
owner: optimizer
---

# Grep-First Reading: Search Before You Read

## When to Apply

Apply this skill **every time you need information from a file**. Before calling
`read(path)`, ask: "Do I need the entire file, or just a specific section?"

Specific triggers:
- **Before reading any file > 5KB** — these are the biggest context wasters.
  A single full read of `method-catalog.md` (76KB) costs more context than
  some entire sessions.
- **When you need a specific entry** (a method, a config key, a log entry, a
  function definition) — search for it instead of scanning the whole file.
- **When re-reading a file** you already read earlier in the session — you
  probably need a different section this time. Use a targeted read, not another
  full read.
- **When processing bash output** that could be large — pipe through `head`,
  `tail`, or `grep` to limit what enters your context.

## Why This Matters

Context is your most expensive resource. Every kilobyte of file content that
enters your context window costs tokens and crowds out reasoning space. The data
is stark:

- Sessions using targeted reads (offset/limit, grep) average **127KB**.
  Sessions using mostly full-file reads average **237KB** — 87% larger.
- The top 8 most-read files account for **2.2MB of wasted context** across
  all sessions. Most of that waste is reading 10-76KB files to use 5% of them.
- Duplicate reads (same file read 2+ times per session) are rampant:
  `criteria.md` read 4× in one session, `deep-dive` docs read 3×,
  `journal.md` read 2-3× routinely.

The leanest sessions (56KB, 29% tool results) all share one trait: targeted
reads with grep and offset/limit. The bloated sessions all share another:
full-file reads of large files, often repeated.

## Steps

### Step 1: SIZE-CHECK (estimate before reading)

Before reading any file, check its size:

```bash
wc -l <file>    # line count
ls -lh <file>   # byte size
```

**Decision rule:**
- **< 50 lines / < 3KB**: Read the whole file. The overhead of searching first
  isn't worth it for small files.
- **50-200 lines / 3-10KB**: Consider whether you need all of it. If you're
  looking for something specific, grep first.
- **> 200 lines / > 10KB**: Always search first. Never full-read a large file
  unless you genuinely need every line (rare).

**Why**: Without knowing the file size, you can't make an informed decision about
how to read it. A 20-line config file is fine to read fully. A 2000-line source
file is not. The size check takes one quick bash call and saves you from loading
tens of kilobytes of irrelevant content.

### Step 2: SEARCH (find what you need)

Use `grep` or `rg` to locate the relevant lines:

```bash
# Find a specific section or keyword
grep -n "keyword" <file>

# Find a function/method definition
grep -n "function myFunc\|def myFunc\|## myFunc" <file>

# Find recent entries (e.g., in a journal)
tail -30 <file>

# Find a section heading and surrounding context
grep -n -A 5 "## Section Name" <file>

# Recursive search across directories
rg "pattern" <directory> --files-with-matches
```

The `-n` flag is essential — it gives you line numbers for the next step.

**Why**: grep reads the file once on disk and returns only matching lines. This is
orders of magnitude cheaper than loading the entire file into your context window
and scanning it yourself. A `grep -n "FM-3.1" method-catalog.md` returns 2 lines
(0.1KB) instead of the full 76KB file.

### Step 3: TARGETED-READ (read only what you need)

Use the line numbers from Step 2 to read just the relevant section:

```bash
# Using read with offset/limit
read(path, offset=<start_line>, limit=<num_lines>)

# Using sed for a specific range
bash("sed -n '45,65p' <file>")

# Using head/tail for file boundaries
bash("head -50 <file>")    # first 50 lines
bash("tail -30 <file>")    # last 30 lines
```

**Sizing your read window**: Take the line number from grep, then read ±10-20
lines of context around it. For a section under a heading, read from the heading
to the next heading of the same level.

**Why**: `read(path, offset, limit)` fetches exactly what you ask for. The tool
supports this precisely so you don't have to load entire files. Using it means
your context contains only relevant content, leaving more room for reasoning
and additional tool calls.

### Step 4: AVOID-DUPLICATE-READS (don't re-read what you already have)

Before reading a file, check: have you already read this file (or this section)
earlier in the session?

- If you read it recently and the content hasn't changed, **refer to your earlier
  read** instead of reading it again.
- If you need a *different* section of the same file, use a targeted read of just
  that section — don't re-read the whole file.
- If you *modified* the file since the last read, a re-read is justified (for
  verification), but target only the modified section.

**Why**: Duplicate reads are the second-biggest source of context waste after
oversized reads. Reading the same 14KB file 3 times means 42KB of your context
is triplicate content — content you already have. Each duplicate read pushes you
closer to the context limit and increases session cost with zero information gain.

## Assertions

1. When the agent reads a file larger than 200 lines, it uses either `offset`/`limit` parameters or a preceding `grep`/`rg`/`wc` call to scope the read — it does not call `read(path)` with no offset on large files.
2. The agent does not read the same file path with identical (or no) offset/limit parameters more than once per session, unless the file was modified between reads.
3. When the agent needs a specific entry (method, config key, log line, section), it uses `grep -n` or `rg` to locate the line number before reading, rather than reading the entire file and scanning.
4. Bash commands that produce potentially large output (e.g., `find`, `cat`, `ls -R`) are piped through a filter (`head`, `tail`, `grep`, `wc`) to limit output size.
5. The agent's total tool-result content (sum of all tool outputs) does not exceed 50% of the session's total content, indicating context is used efficiently.

## Anti-Patterns

### AP-1: Full-Read Scan (reading everything to find one thing)
The agent calls `read(path)` on a large file (10KB+), then uses only a small
portion of the content — a single method entry, one config value, or a few
lines of a log. The other 95% of the file sits in context doing nothing.

**Example**: Coach reads `method-catalog.md` (76KB) fully, then says "I've
read enough of the method catalog" and uses one method entry. A
`grep -n "FM-3.1" method-catalog.md` would have found the section in 0.1KB.

**Fix**: Always grep first for the specific thing you need. If you find yourself
reading a file and then saying "the relevant part is..." — you should have
searched for that part directly.

### AP-2: Repeat-Read Loop (reading the same file multiple times)
The agent reads the same file 2-4 times in a single session, often with the
same parameters. Each read adds the full file content to context again.

**Example**: Tech-lead reads `criteria.md` 4 times in one session — first a
full read, then 3 more reads. Scout reads a deep-dive doc 3 times (42KB of
duplicate content). Optimizer reads `journal.md` 2 times at session start.

**Fix**: On first read, note what you got. On subsequent needs, refer back to
your earlier read or use a targeted read of just the new section you need.
If you catch yourself about to re-read a file, stop and ask: "What specific
new information do I need that I don't already have?"

### AP-3: Firehose Bash (unfiltered command output)
The agent runs a bash command that produces hundreds of lines of output (e.g.,
`find . -name "*.ts"`, `cat large-file.log`, `ls -lR`), all of which enters
the context window. The agent then scans the output for one piece of information.

**Fix**: Pipe through filters before execution:
- `find . -name "*.ts" | head -20` (limit results)
- `cat large.log | grep "ERROR" | tail -10` (filter then limit)
- `ls -la dir/ | wc -l` (count instead of list)
