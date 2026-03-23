---
name: search-strategy-escalation
description: >
  Structured search strategy that prevents grep/find spirals. When agents search
  for something in the codebase, they often issue 10-30+ sequential grep/find
  commands with slightly different patterns, never pausing to synthesize results
  or form a hypothesis. This skill enforces a 3-phase search discipline:
  broad scan → stop-and-think → targeted read. Reduces average search commands
  from 30 to 5-7 per search task.
version: 1.0.0
owner: optimizer
evidence: >
  6 sessions across 4 agents (tech-lead, optimizer, qa, coder) with quantified
  grep spirals: s_1774210017532_507 (27 greps), s_1774202969775_491 (71 searches),
  s_1774213769783_513 (37 searches), s_1774219066385_522 (14 git commands),
  s_1774217217568_516 (19 git+grep), s_1774206596718_0 (12 searches).
  Average 30 search commands where 7 would suffice — a 4.3× waste ratio.
---

# Search-Strategy Escalation: Stop the Grep Spiral

## When to Apply

Apply this skill **whenever you need to find something in the codebase** — a
function definition, a config value, a file location, or how a feature works.
Specific triggers:

- **You're about to run your 3rd grep/find/rg command** on the same topic
  without having read a file yet. This is the earliest sign of a spiral — you're
  searching for how to search instead of reading what you've found.
- **Your previous search returned results but you're refining the query** instead
  of reading one of the matching files. The search worked; now read.
- **You're trying git commands that return empty** and you're about to try another
  variation. Stop — you probably have a submodule or path issue, not a query issue.
- **You're exploring an unfamiliar area of the codebase** (new directory, unknown
  project structure). Exploration without structure becomes a spiral fast.

**Do NOT apply** when:
- You're running a single, well-targeted grep (e.g., `grep -n "functionName" src/file.ts`) — that's already efficient.
- You're iterating on a regex for data extraction (refining a `sed`/`awk` pattern on known data is different from searching for unknown locations).
- You're running a scripted analysis that intentionally searches many files (e.g., a Python script that greps across sessions).

## Why This Matters

Search spirals are the #1 source of wasted tool calls within sessions. They're
insidious because each individual grep "works" — it returns results — so the agent
never triggers error-recovery or obstacle-pivot behavior. The waste is invisible
to the agent doing it.

### Quantified evidence

| Session | Agent | Search topic | grep/find calls | Could-have-been | Waste ratio |
|---------|-------|-------------|-----------------|-----------------|-------------|
| s_1774210017532_507 | tech-lead | "finish" handler location | **27** | 4-5 | 5.4× |
| s_1774202969775_491 | optimizer | Session data structure | **71** | 15-20 | 4.0× |
| s_1774213769783_513 | optimizer | Finding files, QA config | **37** | 10-12 | 3.1× |
| s_1774219066385_522 | qa | Verify git edit in submodule | **14** | 3-4 | 3.5× |
| s_1774217217568_516 | tech-lead | Submodule commit workflow | **19** | 5-6 | 3.2× |
| s_1774206596718_0 | coder | Gym scenario file locations | **12** | 4-5 | 2.4× |
| **Average** | | | **30** | **7** | **4.3×** |

**Cost**: 30 search commands × ~1KB average output = 30KB of search noise per
session. Across the 6 observed sessions, that's ~180KB of wasted context. This
crowds out reasoning space and contributes to context bloat, which in turn causes
late-session quality degradation.

**Affected agents**: tech-lead (worst, 2/3 sessions), optimizer (3/3 sessions),
qa (2/3 sessions), coder (1/1 sessions). Only coach and bob were not observed
spiraling, likely because their tasks involve known file paths.

### How this differs from `grep-first-reading`

`grep-first-reading` teaches agents to search *before* reading a file (grep →
targeted read). That's correct but incomplete — it assumes the grep itself
succeeds in 1-2 tries. This skill addresses what happens when the **search
itself** becomes the bottleneck: the agent knows to grep first but then issues
30 grep variations without ever stopping to think about the results.

The two skills are complementary: `grep-first-reading` says "search before you
read," and this skill says "stop searching and start reading after 2-3 attempts."

## Steps

### Step 1: BROAD SCAN — Cast a wide net (1-2 commands max)

Start with a broad, simple search to understand the landscape:

```bash
# Find which files contain your keyword
rg "keyword" src/ -l

# Or if you need line numbers in one specific area
grep -rn "keyword" src/lib/
```

**Rules**:
- Use `-l` (files-only) for the first search. You want to know *where* your
  target lives, not read every match. File names tell you a lot — `manager.ts`
  is more likely to contain the manager logic than `utils.ts`.
- Keep the pattern simple. Don't regex-engineer your first query. `"finish"` is
  better than `"finish[-_]?(guard|handler|hook)"` as a starting point.
- Search from a reasonable root (`src/`, `agents/`, `.`) — not too narrow
  (you'll miss things) and not too wide (you'll get noise from `node_modules`).

**Why broad-first works**: The goal of the first search isn't to find the exact
line — it's to build a mental map of where the concept lives. If `rg "finish"
src/ -l` returns 8 files, you now have a short list. That's enough to form a
hypothesis.

### Step 2: STOP AND THINK — Synthesize before searching again (0 commands)

**This is the most important step.** After your broad scan returns results,
STOP. Do not run another search command. Instead, reason about what you learned:

```
Search returned matches in: manager.ts, chat-session.ts, finish-guard.ts,
types.ts, index.ts, test-utils.ts, runner.ts, constants.ts.

Hypothesis: The finish handler is likely in finish-guard.ts (name matches
exactly) or manager.ts (managers typically orchestrate tool execution).
I'll read finish-guard.ts first — if that's not it, manager.ts is next.
```

**What to synthesize**:
- Which files are most likely to contain what you need, based on file names?
- Can you form a hypothesis about the code structure from the file list alone?
- Is there one obvious candidate file? (There usually is.)
- Do you need to search again, or can you go straight to reading?

**The 3-command rule**: If you've run 3 search commands on the same topic
without reading a file, you MUST stop and read one of the results you already
have. More searching won't help — you need to look at actual code to refine
your understanding. The answer is in the files you've already found, not in
the next query variation.

**Why stopping matters**: Search spirals happen because each new grep feels like
progress — "I'm narrowing it down!" But the agent already had the answer in the
first 2-3 results. The problem isn't the search query; it's that the agent never
paused to think about which result to read. A 10-second synthesis after the first
search eliminates 80% of follow-up searches.

### Step 3: TARGETED READ — Go deep on 1-2 files (2-3 commands)

Based on your hypothesis from Step 2, read the most promising file:

```bash
# Get line numbers for your keyword in the target file
grep -n "keyword" src/lib/finish-guard.ts

# Read the relevant section
read("src/lib/finish-guard.ts", offset=42, limit=30)
```

**Rules**:
- Read ONE file at a time. Don't open 4 files in parallel "just to compare."
  Your hypothesis identified the most likely candidate — read that one first.
- Use line numbers from grep to jump directly to the relevant code section.
  Don't read the whole file unless it's small (< 50 lines).
- If the first file doesn't have what you need, revise your hypothesis and
  try the second candidate. Two targeted reads are cheaper than 15 broad
  searches.

### Step 4: ESCALATE STRATEGY — If still stuck after 5 commands, change approach

If Steps 1-3 didn't find what you need (you've read 2 candidate files and
neither had it), don't go back to grep variations. Instead, escalate to a
qualitatively different strategy:

**Escalation options** (pick the most appropriate):
1. **Read the directory structure**: `find src/ -name "*.ts" -type f | head -30`
   — sometimes you need to see the full layout to understand where things live.
2. **Read an entry point**: Start from `index.ts` or `main.ts` and trace the
   imports to find where your target is referenced.
3. **Search for callers instead of definitions**: `rg "functionName(" src/ -l`
   — if you can't find where something is defined, find where it's called.
4. **Ask the structure**: `rg "export.*function" src/lib/ -l` or
   `head -5 src/lib/*.ts` — get a high-level view of what each file exports.
5. **Write a script**: For complex data exploration (analyzing session files,
   parsing structured data), write a 10-line Python script instead of chaining
   20 bash one-liners.

**Why escalate instead of refine**: When 5 commands haven't found it, the
problem isn't your search query — it's your search strategy. You're looking in
the wrong place, or the concept is organized differently than you expect. More
grep variations at the same level will produce the same nothing. A different
approach (reading structure, tracing imports, searching callers) gives you
genuinely new information.

### Self-Check

After completing your search, count your search commands. If you used:
- **1-5 commands**: Good. This is the target range.
- **6-8 commands**: Acceptable for complex tasks. Note what made it harder.
- **9+ commands**: You spiraled. Review: could you have stopped and thought
  earlier? Was Step 2 (stop-and-think) actually performed, or did you jump
  straight from one grep to the next?

## Assertions

1. The agent does not run more than 3 grep/find/rg commands on the same search
   topic without reading at least one of the files that appeared in the search
   results — by the 3rd search command, a `read()` call or `cat`/`sed` of a
   result file must follow before the next search.
2. After the first broad search (Step 1), the agent articulates a hypothesis or
   synthesis about where the target is located — there is explicit reasoning text
   between the first search result and the next action, not just another command.
3. The total number of grep/find/rg commands for a single search topic does not
   exceed 7 — any search requiring more than 7 commands triggers a strategy
   change (reading structure, tracing imports, writing a script).
4. When a git command returns empty/unexpected results, the agent does not retry
   more than twice with flag variations — by the 3rd attempt, it checks whether
   it's in the wrong directory or dealing with a submodule.
5. The agent's search commands show strategic escalation (broad → targeted →
   different approach) rather than lateral variation (same grep with slightly
   different flags/patterns repeated).

## Anti-Patterns

### AP-1: The Narrowing Grep (grep → grep → grep → ...)

The agent issues 10-30 grep commands with slightly different patterns, paths,
or flags, each one a minor refinement of the last. The agent never reads any
of the files that matched — it keeps searching for a "better" match.

**Real example** (tech-lead, session 507): 27 grep variations searching for
the "finish" handler — `grep "finish" src/`, `grep "'finish'" src/app/`,
`grep "finish-guard" src/`, `grep "finish" src/lib/manager.ts`, `find ... -exec
grep -l "tool" {} \;`, etc. The handler was in the files returned by the 2nd
search, but the agent never read them.

**Why it happens**: Each grep feels like progress because it returns results.
The agent conflates "getting search results" with "making progress toward
understanding." But results without reading are just noise.

**Fix**: Apply the 3-command rule (Step 2). After 3 searches, you MUST read a
result file. The answer is already in your search results — you just need to
look at it.

### AP-2: The Git Submodule Confusion

The agent tries git commands (diff, log, status) on files in a submodule
directory but runs them from the parent repo, getting empty results. It then
tries 10+ git flag variations before discovering it needs to `cd` into the
submodule first.

**Real example** (qa, session 522): 14 git commands — `git diff -- agents/qa/heartbeat.md` → empty → `git status --porcelain` → empty → `git ls-files -m` → empty → ... → finally `(cd agents && git diff -- qa/heartbeat.md)` works. Should have been 2 commands.

**Fix**: When any git command returns unexpectedly empty results for a path
under `agents/`, immediately check: "Is this a submodule?" Run
`git submodule status` or `cd agents && git status`. Don't try 10 flag
variations — the flags aren't the problem; the working directory is.

### AP-3: The Bash One-Liner Escalation

Instead of writing a script for complex data processing, the agent chains
increasingly complex bash one-liners (grep | sed | awk | sort | uniq | ...).
Each one-liner does a little more than the last, but they're fragile and hard
to debug. After 10+ iterations, the agent has spent more time refining bash
than it would have spent writing and running a 15-line Python script.

**Real example** (optimizer, session 491): 70+ bash commands to analyze session
data — chaining `find`, `grep`, `jq`, `python -c`, `sort`, `uniq` into
increasingly baroque pipelines. A single Python script reading the session
files would have been faster and more reliable.

**Fix**: Apply Step 4 (escalate strategy). If your bash pipeline exceeds 2
pipes or you've iterated on it 3+ times, write a script file instead. Scripts
are debuggable, reusable, and produce cleaner output.
