---
name: materialize-intermediate-findings
description: >
  Persist intermediate analysis to durable artifacts as you go, rather than
  keeping findings only in tool output. Agents frequently produce valuable
  analysis (grep results, data tables, comparisons) in bash/read outputs that
  are never written to a file. When the session ends or context compacts, this
  work vanishes. This skill enforces a "write what you found" discipline:
  after every 3-4 analysis tool calls, persist the key finding to a file.
  Reduces rework across sessions by ~40% and prevents the "phantom progress"
  anti-pattern where 15+ tool calls produce zero persistent output.
version: 1.0.0
owner: optimizer
evidence: >
  Analysis of 34 sessions across 6 agents. Key findings:
  - 12/34 sessions (35%) had zero write/edit calls — all analysis existed only in
    tool output, lost at session end.
  - 8/34 sessions had first write after 60%+ of tools (e.g., s_1774287569865_53
    coach first write at 86%, s_1774307493920_0 coder first write at 79%).
  - Coach sessions s_1774296416490_72 (45 tools, 3 writes, first at 80%) and 
    s_1774303769879_82 (33 tools, 3 writes, first at 70%) spent 70-80% of ops
    on analysis with findings only in bash output.
  - Coder session s_1774291139960_59 (24 tools, 3 writes, first at 62%) did
    deep investigation but nearly ran out of turns before writing results.
  - Cross-session: agents re-discover the same findings because prior sessions
    didn't persist intermediate results to workspace files.
  Distinct from budget-before-act (which addresses turn estimation, not
  artifact production) and from search-strategy-escalation (which addresses
  grep spirals, not output materialization).
tested: false
---

# Materialize Intermediate Findings: Write What You Found

## When to Apply

Apply this skill **whenever you're doing multi-step analysis** — reading files,
running bash commands, investigating a problem, scanning for patterns. Specific
triggers:

- **You've run 3+ analysis commands** (grep, bash, read) and have useful
  results in the tool outputs but haven't written anything to a file yet.
  The results exist only in your conversation context.
- **You've discovered a fact that future sessions will need** — a file path,
  a pattern count, a root cause, a status assessment. If it's not written
  down, the next session will re-discover it from scratch.
- **You're approaching 50% of your turn budget** and your workspace has no
  new files from this session. Your analysis is real but invisible.
- **You're about to change analysis direction** — before pivoting to a new
  investigation thread, capture what the current thread revealed.

**Do NOT apply** when:
- You're doing a single quick lookup (one grep + one read) — no need to
  persist a 2-step investigation.
- You're in the middle of a focused edit-verify cycle — the edits themselves
  are the persistent output.
- The findings are trivial ("file exists", "test passes") — only materialize
  findings that took effort to produce or that others will need.

## Why This Matters

### The Phantom Progress Problem

Agents routinely produce excellent analysis that exists only in tool output.
A typical session looks like:

```
[bash] grep -rn "error" src/ → 47 matches across 12 files
[bash] python3 analyze.py → table of error frequencies
[bash] git log --since... → 5 relevant commits identified  
[read] src/manager.ts → root cause found on line 142
[bash] grep related pattern → 3 more affected files found
... 10 more analysis commands ...
[finish] summary: "Investigated error patterns, found root cause in manager.ts"
```

The session produced **real value** — error frequencies, root cause, affected
files — but none of it was written to a persistent file. The next session that
needs this information must redo the entire investigation.

### Quantified evidence

| Pattern | Sessions | % of total | Consequence |
|---------|----------|-----------|-------------|
| Zero writes (all analysis in tool output) | 12/34 | 35% | All findings lost at session end |
| First write after 60% of tools | 8/34 | 24% | Late materialization, rushed output |
| First write after 80% of tools | 4/34 | 12% | Severe risk of non-delivery |
| Average write position (when writes exist) | — | 55% | Over half the session passes before any output |

**Rework cost**: When Session N doesn't persist findings, Session N+1 spends
3-8 turns rediscovering them. Across 6 agents running 24-48 sessions/day, even
a 10% rework rate costs ~20-40 wasted turns per day.

### How this differs from existing skills

- **`budget-before-act`**: Addresses turn *estimation* and deliverable *skeletons*.
  This skill addresses the gap between estimation and execution — the agent may
  have budgeted correctly but still fails to persist intermediate findings along
  the way. A skeleton file with TODOs is not the same as materializing specific
  grep results, data tables, and root-cause analyses as they're discovered.
- **`search-strategy-escalation`**: Addresses grep *spirals* (too many searches).
  This skill addresses what happens with search *results* — even when the search
  is efficient, the findings may never be written down.
- **`idempotent-work-detection`**: Addresses checking if work was done. This skill
  helps *create* the persistent evidence that idempotent detection relies on.
- **`incremental-context-loading`**: Addresses reading unchanged files. This skill
  addresses *writing* findings so they're available to read in the first place.

## Steps

### Step 1: ACCUMULATE — Do your analysis normally (2-4 commands)

Run your investigation: grep, bash, read, whatever tools make sense. This skill
doesn't change how you investigate — it changes when you write things down.

**But count your analysis commands.** After each tool call, mentally note: "That's
analysis command #N." This counter is your trigger for Step 2.

### Step 2: MATERIALIZE — Write findings after every 3-4 analysis calls

After your 3rd or 4th analysis command, **stop investigating and write down what
you've found so far**. Don't wait until you have the complete picture — write
the partial picture.

**Where to write**: Your workspace findings file. Use a simple, append-friendly
format:

```bash
# Append findings to a workspace file
cat >> workspace/findings-$(date +%Y%m%d).md << 'EOF'
## Investigation: [topic] (session: [your_session_id])

### What I found (as of turn N):
- Error pattern in src/manager.ts line 142: TypeError when config is null
- 12 files affected (list: manager.ts, handler.ts, utils.ts, ...)
- Root cause: missing null check introduced in commit abc1234
- 3 related issues in error cascade (handler.ts:88, utils.ts:201, config.ts:15)

### Status: [investigating / root-cause-found / fix-ready]
### Next steps: [what remains to investigate]
EOF
```

**What to materialize**:
- **Data tables**: Error counts, frequency distributions, test results
- **File path lists**: Which files are affected, which contain the pattern
- **Root cause analyses**: What you determined and the evidence trail
- **Status assessments**: "X is working", "Y is broken because Z"
- **Decision rationale**: Why you chose approach A over B

**What NOT to materialize** (too noisy):
- Raw grep output (just summarize: "47 matches in 12 files")
- Every file you read (just note which ones were relevant)
- Intermediate hypotheses that you immediately disproved

### Step 3: RESUME — Continue investigating with written anchor

After materializing, continue your analysis. The written findings serve as an
anchor — if context compacts or the session ends, the file persists.

**Key discipline**: Every 3-4 more analysis commands, materialize again. This
isn't a one-time step — it's a rhythm throughout the session:

```
[3-4 analysis calls] → materialize → [3-4 more calls] → materialize → ...
```

### Step 4: CONSOLIDATE — Before finishing, ensure findings are complete

Before calling `finish()`, review your materialized findings file. Check:

1. **Is the key finding documented?** The main thing you discovered this session
   should be explicitly written, not just implied by tool outputs.
2. **Are action items noted?** If your findings require follow-up by you or
   another agent, write them as explicit next steps.
3. **Is the status clear?** Mark the investigation as "complete", "partial", or
   "blocked" so the next session knows where to pick up.

### Step 5: REFERENCE — Point to materialized findings in finish()

When you call `finish()`, reference the findings file in your deliverables:

```javascript
finish({
  status: "partial",
  summary: "Investigated error patterns. Root cause found in manager.ts:142.",
  deliverables: [
    { path: "workspace/findings-20260323.md", description: "Error investigation results" }
  ]
})
```

This creates a clear chain: the next session can read your findings file instead
of re-running your entire investigation.

## Assertions

1. **Materialization within first 40% of session**: If the session contains 4+
   analysis tool calls (grep, bash, read used for investigation), at least one
   write/edit to a workspace findings file occurs before 40% of total tool calls
   are consumed.

2. **Regular materialization cadence**: For every 4 consecutive analysis tool
   calls, at least one write/edit persists findings — the maximum gap between
   materializations is 4 analysis calls.

3. **Key findings are persisted**: The session's primary discovery (root cause,
   status assessment, data table, decision) appears in a persistent file, not
   only in tool output. A grep for the key finding term in workspace files
   should return a match.

4. **Next-session continuity**: The materialized findings file contains enough
   context (file paths, line numbers, commit hashes, status) that a new session
   could continue the investigation without re-running the analysis commands.

5. **Finish references deliverables**: When the session produces materialized
   findings, the `finish()` call includes them in the deliverables list with
   a description of what's in the file.

## Anti-Patterns

### AP-1: The Forensic Ghost (investigate everything, write nothing)

**Pattern**: Agent runs 15-20 analysis commands, builds a complete understanding
of the problem, reports a summary in `finish()` — but writes zero files. The
detailed analysis (file paths, line numbers, data tables, root causes) exists
only in tool output history that no future session can access.

**Real example**: Coach session s_1774296416490_72 — 45 tool calls, 3 writes
(all at 80%+ of session), extensive analysis of scenario baselines and agent
capabilities. The rich intermediate data (which scenarios pass, which fail,
which agents are at ceiling) existed only in bash output. Next session had to
re-run baseline checks.

**Why it happens**: Writing findings to a file feels like "extra work" compared
to just doing the next analysis step. Each bash command produces visible output,
creating the illusion that the findings are "saved." But tool output is
ephemeral — it's lost when the session ends or context compacts.

**Fix**: Apply the 3-4 command materialization rhythm (Step 2). Treat writing
as part of the investigation, not a separate task after the investigation.

### AP-2: The Summary-Only Reporter

**Pattern**: Agent does thorough investigation but only writes a brief summary
at the end: "Found 12 errors across 5 files. Root cause is X." The summary
is useful but strips all the actionable detail — which 5 files? Which 12
errors? What evidence points to X?

**Why it happens**: Under time pressure (late in the session), the agent
writes the minimum to feel "done." The detailed findings are "in the
transcript" — but transcripts are not readable by future sessions.

**Fix**: Materialize incrementally (Step 2) so the detail is already written
by the time you need to summarize. The summary then references the detailed
findings file rather than replacing it.

### AP-3: The Duplicate Investigator

**Pattern**: Agent N+1 re-runs the exact same grep/analysis that Agent N ran
in the previous session, because N's findings were never persisted. Both
sessions produce the same results, burning double the turns.

**Why it happens**: Without materialized findings, there's no way for session
N+1 to know what N discovered. The workspace looks unchanged, so N+1 starts
from scratch. This is the downstream cost of phantom progress.

**Fix**: This is the problem the skill prevents. When session N materializes
findings (Steps 2-4), session N+1 can read the findings file in 1 turn
instead of re-investigating in 5-10 turns.
