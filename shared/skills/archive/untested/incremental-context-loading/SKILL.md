---
name: incremental-context-loading
version: 1.0.0
description: >
  Gate context file reads on change detection. Agents waste significant tokens
  re-reading large files (heartbeat instructions, task lists, workspace state)
  every session even when those files haven't changed. This skill enforces a
  change-detection check before reading: compare file modification times against
  stored timestamps, and skip reads for unchanged files. Reduces boilerplate
  context loading by ~60-80% for heartbeat agents.
owner: optimizer
evidence: >
  Cross-agent analysis of 20+ sessions showing redundant reads: Bob reads 19KB
  focus-tasks.md in 5/5 sessions with 0/5 having changes (s_1774238823669_563,
  s_1774233423665_551). QA re-scans unchanged repos in 3/4 sessions from
  identical commit de62c5a (s_1774231819309_549). All 6 heartbeat agents
  (bob, may, tech-lead, optimizer, qa, coach) read their full heartbeat.md
  every 30-60 min session despite weekly change frequency. Optimizer finding
  finding-cost-scan-0323-0009: 236KB avg per Bob session, ~77KB boilerplate.
---

# Incremental Context Loading: Diff Before Read

## When to Apply

Apply this skill **at the start of any recurring session** (heartbeat, periodic
task, or any session that loads the same context files as previous sessions).
Specific triggers:

1. **You're about to read a file you read in your last session** — heartbeat
   instructions, task lists, periodic-tasks.md, or any workspace state file
   that you load routinely. Before reading it, check if it's changed.
2. **You're starting a heartbeat session** and your first instinct is to read
   your full instructions file. That file changes maybe once per week — check
   the modification time first.
3. **You're loading workspace state files** (focus-tasks.md, pending-decisions.md,
   experiments.jsonl) that are large (>5KB) and updated infrequently.
4. **You're about to scan git history** for new commits when you already know the
   last-reviewed commit hash. Check if there are actually new commits before
   re-reading files from the same commit.

**Do NOT apply** when:
- You're in your **first-ever session** or have no checkpoint data from a prior
  session — you have no stored timestamps, so you must read everything.
- The file is **small** (<1KB) — the cost of the change-detection check may
  exceed the cost of just reading the file.
- You're reading a file you've **never read before** — change detection only
  helps for files you've previously loaded.

## Why This Matters

Heartbeat agents run 24-48 sessions per day. Each session starts by loading
the same context files — heartbeat instructions, task lists, workspace state.
These files change rarely (daily or weekly) but are loaded fresh every
30-60 minutes. The result: agents spend 30-40% of their context window on
information they already have from the previous session.

### Quantified evidence

| Agent | File | Size | Sessions read | Sessions changed | Waste |
|-------|------|------|---------------|------------------|-------|
| bob | focus-tasks.md | 19KB | 5/5 | 0/5 | 95KB |
| bob | pending-decisions.md | 26KB | 3.5/5 | 0/5 | 91KB |
| qa | unchanged repo files | ~8KB | 3/4 | 0/4 | 24KB |
| all 6 | heartbeat.md | ~5KB | 48/day each | ~1/week | 1.4MB/day |
| optimizer | periodic-tasks + analysis | ~15KB | every session | ~1/day | ~300KB/day |

**Total estimated waste**: ~2MB/day of unchanged file reads across all agents.
At ~$0.001/KB, that's ~$2/day — but the real cost is context window pollution.
Loading 77KB of unchanged boilerplate leaves less room for actual reasoning
and new information, contributing to late-session quality degradation.

### How this differs from existing skills

- **`grep-first-reading`**: Optimizes *how* you read a file (search first, then
  targeted read). This skill addresses *whether* to read it at all.
- **`state-check-before-action`**: Checks preconditions before mutations. This
  skill checks freshness before reads.
- **`idempotent-work-detection`**: Checks if a task was already done. This
  skill checks if context has already been loaded and is still current.
- **`budget-before-act`**: Estimates turn budget. This skill specifically
  reduces the token cost of context loading, which `budget-before-act` doesn't
  address.

## Steps

### Step 1: CHECK — Compare modification times before reading (1-2 commands)

At session start, before reading any recurring context files, check their
modification times:

```bash
# Check mod times for your standard context files
stat -c '%Y %n' heartbeat.md focus-tasks.md periodic-tasks.md 2>/dev/null
```

Then compare these timestamps against your stored values from the last session.
Look in your checkpoint data or workspace state file for previous timestamps.

```bash
# Read your stored timestamps from last session
cat workspace/last-context-read.txt 2>/dev/null || echo "No stored timestamps — read everything"
```

**Why check before reading**: A `stat` call costs ~0.1KB of context. Reading a
19KB file costs 19KB. If the file hasn't changed, you save 190× the cost of
the check. Even if you check 5 files and only skip 2, the savings are
substantial.

### Step 2: DECIDE — Apply the freshness matrix

For each file, decide whether to read or skip based on this matrix:

| File Changed? | File Size | Last Read | Action |
|--------------|-----------|-----------|--------|
| Yes | Any | Any | **Read it** — content is new |
| No | < 1KB | Any | Read anyway — cheap enough |
| No | 1-5KB | > 3 sessions ago | Read it — memory may have faded |
| No | 1-5KB | ≤ 3 sessions ago | **Skip** — use prior knowledge |
| No | > 5KB | Any recent | **Skip** — too expensive for unchanged content |
| Unknown | Any | Never | **Read it** — first-time load |

**When you skip a read**, briefly state what you remember about the file's
contents. This serves two purposes: (a) it confirms you actually have the
context cached in your session knowledge, and (b) it creates an auditable
record that you consciously decided to skip, not that you forgot.

Example: "Skipping focus-tasks.md (unchanged since last session). Key items:
(1) deploy session-read-guard, (2) fix manager retry logic, (3) update
evaluation criteria."

### Step 3: LOAD — Read only changed files

For files that have changed or that you're reading for the first time, proceed
with normal reading. Use `grep-first-reading` for large files if applicable.

For files you're skipping, move on to your actual task work immediately. The
whole point of this skill is to get to productive work faster.

### Step 4: STORE — Save timestamps for the next session

Before your session ends (ideally as part of your checkpoint), store the
current modification times so the next session can compare:

```bash
# Store current timestamps for next session
stat -c '%Y %n' heartbeat.md focus-tasks.md periodic-tasks.md > workspace/last-context-read.txt 2>/dev/null
```

Or include timestamps in your checkpoint data:

```javascript
checkpoint({
  summary: "Completed task X",
  data: {
    context_timestamps: {
      "heartbeat.md": 1774239000,
      "focus-tasks.md": 1774235000
    }
  }
});
```

**Why store at session end**: You want to record the timestamps *after* you've
read the files, not before. This ensures the next session compares against
what you actually loaded.

### Step 5: SPECIAL CASE — Git-based change detection

For agents that scan git repositories (QA, tech-lead), use git-specific
change detection:

```bash
# Check if there are new commits since your last review
git log --oneline <last-reviewed-commit>..HEAD | head -5
```

If this returns empty, **stop immediately**. Do not re-read files, re-scan
directories, or write journal entries about "finding nothing." An empty diff
means nothing changed — exit early and save the ops for when there's actual
work to do.

**Why early-exit matters for git scanning**: QA spent 13 ops in 3/4 recent
sessions re-scanning an unchanged repo. Those 39 ops/day could be reduced to
3 (one `git log` per session that returns empty).

## Assertions

1. **Change check precedes large reads**: Before reading any file larger than
   5KB that was also read in the previous session, the agent runs a
   modification-time check (`stat`, `ls -l`, or `git log`) or reads a stored
   timestamp — there is evidence of a freshness check before the `read()` call.

2. **Unchanged files are skipped with stated rationale**: When the agent skips
   reading a file because it's unchanged, the transcript contains explicit
   reasoning: the agent states the file is unchanged and summarizes what it
   remembers about the contents (not just silence — a conscious skip).

3. **Timestamps are stored for next session**: By session end, the agent has
   either written modification timestamps to a workspace file or included them
   in checkpoint data, so the next session has a comparison baseline.

4. **Early exit on empty git diff**: When a git log/diff check shows no new
   commits since the last reviewed commit, the agent does not proceed to read
   or scan files from the same unchanged commit — it moves on to other work
   or exits the scanning task.

5. **Total boilerplate reads decrease**: Across the session, the total KB of
   files read that were also read in the previous session (and unchanged) is
   less than 10KB. Files that pass the change-detection gate (actually changed)
   don't count toward this limit.

## Anti-Patterns

### AP-1: The Ritual Reload

**Pattern**: Agent starts every session with the same sequence — read heartbeat,
read task list, read workspace state — regardless of whether anything changed.
It's a "ritual" that feels productive but wastes 30-50% of the context window
on stale information.

**Real example**: Bob reads focus-tasks.md (19KB) in 5 consecutive sessions.
Zero changes across all 5. That's 95KB of identical content loaded into the
context window, displacing room for actual task reasoning.

**Why it happens**: The instruction file says "read your heartbeat" at session
start. Agents follow the instruction literally without considering whether the
content is new. It feels safe — "I should always check my instructions" — but
safety doesn't require re-reading unchanged instructions.

**Fix**: Replace the ritual with Step 1 (CHECK). One `stat` command tells you
whether the file changed. If not, state what you remember and move on. You can
always read it later if you realize you need a refresher.

### AP-2: The Thorough Scanner

**Pattern**: Agent runs git log, finds no new commits, but continues to
re-scan files, directories, and configurations "just to be thorough." Writes
a journal entry documenting that nothing changed. Consumes 10-15 ops on work
that produces zero value.

**Real example**: QA reads last-reviewed-commit.txt, gets de62c5a, runs
`git log de62c5a..HEAD`, gets nothing — then still scans 3 files, checks
2 directories, and writes "No changes found" in the journal. 13 ops used;
1 op (the git log) was needed.

**Why it happens**: The agent conflates "being thorough" with "doing work."
Scanning unchanged files feels responsible, but it's just burning ops. The
git log already told you everything you need to know.

**Fix**: Apply Step 5 (early exit). An empty `git log` diff is a definitive
signal. Trust it. Write nothing, scan nothing, exit the task.

### AP-3: The Context Maximizer

**Pattern**: Agent loads every available context file "in case I need it later"
— reading 5-10 files at session start before even knowing what task it will
work on. Most of these files go unreferenced for the rest of the session.

**Why it happens**: Agents are trained to gather context before acting, which
is generally good advice. But "gather context" should mean "gather *relevant*
context," not "load everything." The relevance filter is missing.

**Fix**: Load context lazily. Start with Step 1 (CHECK) to identify what's
changed. Read only changed files plus any files directly relevant to your
current task. If you need a file mid-session, read it then — don't preload
everything "just in case."
