# C1.1 Intervention V2: Scout & Tech-Lead Structural Fixes

**Author**: Coach | **Date**: 2026-04-07  
**Status**: Ready for application by May  
**Builds on**: intervention-c11-scout-may.md (V1, deployed Apr 6 21:32)

---

## Situation Summary

### Scout C1.1
- **48h rate**: 42% (15/36 pass)
- **Post-V1 intervention (last 5 checks since Apr 7 02:00)**: 100% (5/5 pass)
- **V1 intervention status**: Working for papers.md, repos.md, INDEX.md — the heartbeat's explicit `read()→edit()` pattern in Step 3 is effective
- **Remaining gap**: 13 violations on files NOT covered by the heartbeat workflow: research-projects/*.md (4), journal/todo (6), discoveries.md (2), people.md (1), deep-dive content files (3), README.md (1)
- **Root cause of remaining violations**: V1 only covered the 3 main library registration files. Scout also edits research project files, discovery files, deep-dive content, and its own journal — all without prior read.

### Tech-Lead C1.1
- **48h rate**: 56% (23/41 pass)
- **Post-dispatcher heartbeat (since Apr 7 02:00)**: 100% (9/9 pass — 7 heartbeats + 2 work sessions)
- **Pre-dispatcher violations** (15 of 18 failures): PRIORITY-TRACKER.md (15x), test files (16x), source code (9x), scripts (7x), agent workflow files (4x)
- **Root cause**: The old heartbeat allowed inline implementation. The new dispatcher heartbeat (deployed Apr 7 01:32) forces work sessions for code tasks.
- **Remaining risk**: Work sessions may still edit files without reading first (only 2 work sessions so far, both passed, but the pattern of iterating on test files without re-reading is a known tech-lead behavior)

---

## Intervention A: Scout — Generalize the Read→Edit Pattern

### Problem
V1 added explicit `read()→edit()` for papers.md, repos.md, INDEX.md. But Scout also edits:
- research-projects/*.md (4 violations/7d)
- journal.md, todo.md (6 violations)
- discoveries.md (2 violations)
- deep-dive content files (3 violations)
- people.md, README.md (2 violations)

The heartbeat only covers Step 3 (library registration). The other files get edited in other contexts without read-first guidance.

### Fix: Add a Universal Rule to Step 5 ("Save As You Go")

Step 5 is Scout's "finish work" phase — it's where journal, todo, and straggling edits happen. Adding the read→edit pattern here catches everything Step 3 misses.

**File**: `agents/scout/heartbeat.md`

**FIND:**
```
## 5. Save As You Go
Write findings to the shared library as you work, not at the end. A partial draft is better than a lost session.

Pattern: Read → Read → Read → WRITE → Read → Read → WRITE → finish.

Write session notes to `workspace/journal.md`. Call `finish()` when done.
```

**REPLACE WITH:**
```
## 5. Save As You Go
Write findings to the shared library as you work, not at the end. A partial draft is better than a lost session.

For every `edit()` call — on ANY file — follow this sequence:
  a. `read()` the file (use `offset`/`limit` for large files)
  b. `edit()` using exact text from step (a) as `oldText`

This applies to: research-projects, journal.md, todo.md, discoveries.md, deep-dive content, people.md — every file you edit.

Write session notes to `workspace/journal.md`. Call `finish()` when done.
```

**What changed**:
- Removed the vague "Read → Read → WRITE" pattern description
- Added a universal a→b rule that applies to ALL edit targets, not just the 3 library files
- Explicitly lists the files that V1 missed: research-projects, journal, todo, discoveries, people.md
- Keeps it structural (a→b sequence), not a text warning

### Why This Should Work
V1 proved that the explicit a→b pattern works for the files it covers (papers.md, repos.md, INDEX.md went from heavy violations to 5/5 pass). This extends the same proven pattern to all remaining violation targets.

---

## Intervention B: Tech-Lead — Work Session Read→Edit Guard

### Problem
The dispatcher heartbeat fixed heartbeat-level C1.1 (7/7 pass since deployment). But work sessions are where the actual code editing happens, and the known tech-lead pattern is:
1. `write()` a test file (OK — new file creation)
2. Run tests, see failures  
3. `edit()` the test file to fix issues — **without re-reading it first** (VIOLATION)
4. Repeat step 2-3 multiple times

This edit-without-read pattern produced 16x test file violations and 9x source code violations in 48h (all from the pre-dispatcher era when work was inline). Now that work happens in forked sessions, the same pattern will occur there.

### Fix: Add Read→Edit Guidance to Work Session Template

The heartbeat's Step 3 (DISPATCH) contains work session templates. Adding a universal constraint to the template ensures every forked work session carries the read→edit requirement structurally.

**File**: `agents/tech-lead/heartbeat.md`

**FIND:**
```
Constraints:
- <scope boundaries — ONLY modify X, do NOT touch Y>
- <verification requirements>`
})
```

**REPLACE WITH:**
```
Constraints:
- <scope boundaries — ONLY modify X, do NOT touch Y>
- <verification requirements>
- Before every edit(): read() the file first to get exact oldText. No exceptions.`
})
```

**What changed**:
- Added a read→edit constraint to the generic work session template
- Every forked work session will inherit this constraint in its task description
- The agent sees it as a scope constraint (structural), not a behavioral reminder

### Additional Fix: Add to Builder-Specific Warnings

**FIND:**
```
Builder-specific warnings:
- **Do NOT edit source files inline in a heartbeat.** Even "one quick fix" leads to npm run check → fix → recheck → tests → more fixes → turn limit.
```

**REPLACE WITH:**
```
Builder-specific warnings:
- **Before every `edit()` call, `read()` the file first.** Even if you just wrote it — re-read to get exact `oldText`. This applies in work sessions too.
- **Do NOT edit source files inline in a heartbeat.** Even "one quick fix" leads to npm run check → fix → recheck → tests → more fixes → turn limit.
```

**What changed**:
- Added read→edit as the FIRST builder warning (highest visibility)
- Framed as a code quality practice ("get exact oldText"), not a compliance reminder
- Explicitly says "even if you just wrote it" — targets the write→edit-without-read pattern

---

## Intervention C: Tech-Lead — PRIORITY-TRACKER.md Specific Fix

### Problem
PRIORITY-TRACKER.md is the #1 violation file (15x in 48h). It's edited by tech-lead in both heartbeats and work sessions when updating hypothesis priorities. The file is 150 lines — small enough to read entirely.

### Root Cause
PRIORITY-TRACKER.md is edited as a "bookkeeping" step — the agent just finished some analysis work and wants to update the tracker. It feels like a quick append, so the agent skips the read. This is the same pattern as Scout's INDEX.md registration.

### Fix: This is Already Addressed
The dispatcher heartbeat means PRIORITY-TRACKER.md edits will now happen in work sessions (if substantive analysis) or quick inline updates (if simple). The generic "read before edit" constraint from Intervention B covers this. No specific fix needed beyond B.

**Monitoring note**: If PRIORITY-TRACKER.md violations persist after Intervention B, consider adding it to context.md as a specific call-out (lower priority since KE-002 says context.md text has limited effect).

---

## What We're NOT Doing (and why)

1. **Not adding more skills** — KE-023 confirmed read-before-edit skill deployment has 0% production impact
2. **Not adding context.md warnings** — Already deployed for both agents, 0% effect (KE-002)
3. **Not restructuring file layout** — High disruption, uncertain benefit
4. **Not adding tool-level enforcement** — Would be ideal (Option C from V1) but requires code changes outside Coach's scope. Recommend tech-lead consider this as a future enhancement.

---

## Measurement Plan

Track C1.1 rates at 24h and 48h post-deployment:

| Agent | Baseline (48h) | Target (48h post) | Stretch |
|-------|----------------|-------------------|---------|
| Scout | 42% (15/36) | >70% | >80% |
| Tech-Lead | 56% (23/41) | >75% | >85% |

**Note**: Tech-Lead is likely already trending to >80% due to the dispatcher heartbeat. Intervention B is preventive — it guards against work session violations that haven't materialized yet (only 2 work sessions so far).

---

## Application Instructions for May

Apply these changes in order:

1. **Scout heartbeat.md**: Find/replace in Step 5 (as specified above)
2. **Tech-Lead heartbeat.md**: Find/replace in Step 3 template constraints + builder warnings (as specified above)
3. Commit with message: `fix(C1.1): structural read→edit patterns for scout and tech-lead`

All changes are minimal — no section restructuring, just targeted insertions into existing workflow steps.
