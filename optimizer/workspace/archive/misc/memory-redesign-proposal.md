# Agent Memory System Redesign Proposal
**Author**: Optimizer | **Date**: 2026-03-17 | **Status**: Phase 1 COMPLETE  
**Requested by**: Human (req:8a919a7f)

## Problem Statement

The LESSONS.md-based memory system is broken in 4 specific ways:

### P1: Lessons Never Graduate
LESSONS.md entries accumulate forever. They're designed as a "staging area" but no mechanism reliably promotes them to structural homes (heartbeat.md, DOMAIN.md, SOUL.md, tool code) or deletes them.

**Evidence**: 67,648 bytes across 13 LESSONS.md files. Only QA (729 bytes) has successfully graduated its lessons. tech-lead has 12,013 bytes, may has 10,358, bob has 8,939.

### P2: Lessons Reference Dead Infrastructure
Multiple lessons still reference deleted files (SIGNALS.md, todo.md) or deprecated patterns.

**Evidence**: 
- `agents/amy/LESSONS.md` references `agents/shared/SIGNALS.md` (deleted)
- `agents/may/LESSONS.md` references todo.md path (replaced by request DB)
- Graduated/obsolete entries remain in files with strikethrough but still consume tokens

### P3: Massive Duplication (52% of content)
Universal conventions (C26, C40, C24, C23, C25, C22) are duplicated across 3-8 agent files each, wasting ~8,750 tokens. Each copy has slightly different wording.

**Evidence**: C26 appears in 9 files, C40 in 7 files, C24 in 6 files. See `memory-redesign-analysis.md` for full breakdown.

### P4: No Structural Distinction Between Lesson Types
A "lesson" can be:
- A universal behavioral convention (belongs in shared)
- An agent-specific failure pattern (belongs in agent LESSONS.md)
- A graduated structural rule (belongs in DOMAIN/SOUL/heartbeat)
- A dead/obsolete workaround (should be deleted)

All four sit in the same flat list with no differentiation or lifecycle tracking.

---

## Current Architecture

```
System Prompt Assembly (src/lib/manager.ts):
  1. SOUL.md          — identity (protected, P53)
  2. DOMAIN.md        — domain expertise (protected, P53)
  3. TOOLS.md         — tool usage guide (protected, P53)
  4. shared/LESSONS.md — shared lessons (487 bytes, underutilized)
  5. LESSONS.md       — agent-specific lessons (avg 5,557 bytes, bloated)
  6. INDEX.md         — knowledge index
  7. shared/INDEX.md  — shared knowledge index
  8. context_files    — additional per-agent context
```

**Loading**: shared/LESSONS.md is loaded for ALL agents automatically (line 349 of manager.ts). Individual LESSONS.md loads next (line 351). Both concatenated into system prompt.

**Writing**: Coach writes to individual LESSONS.md via Growth Cycle. No mechanism writes to shared/LESSONS.md.

**Cleanup**: No automated mechanism. Manual review by Optimizer (periodic task) is the only path.

---

## Proposed Redesign

### Design Principles
1. **Lessons are temporary** — they exist to address active failure patterns, not as permanent storage
2. **Universal rules belong in shared/** — if a convention applies to all agents, it goes in one place
3. **Structure > band-aids** — when a lesson is stable for 2+ weeks, it should graduate or die
4. **Dead entries cost money** — every obsolete line wastes tokens on every session

### Architecture Changes

#### Change 1: Populate shared/LESSONS.md with Universal Conventions

Move C26, C40, C24, C23, C25, C22 into `agents/shared/LESSONS.md` and remove duplicates from all individual files.

**Impact**: ~7,000 tokens freed across the system (~700/agent average)

#### Change 2: Enforce LESSONS.md Size Budgets

Add a section header convention to individual LESSONS.md files:

```markdown
# Lessons (Agent-Specific)
<!-- Budget: max 2,000 bytes. If over, graduate or delete entries. -->

## Active Band-Aids (temporary — must graduate within 2 weeks)
- [entry with date added]

## Agent-Specific Patterns (permanent — unique to this agent)
- [entry]
```

**Enforcement**: Optimizer's periodic "LESSONS.md graduation audit" checks sizes and proposes cuts. Coach's Growth Cycle checks shared/LESSONS.md before adding duplicates.

#### Change 3: Graduation Automation via Cron

Create a JS handler (`lessons-graduation.ts`) that runs daily and:
1. Scans all LESSONS.md files for entries older than 14 days (via date markers)
2. Checks if the same convention exists in shared/LESSONS.md (skip if so)
3. Flags oversized files (>2,000 bytes) in a report
4. Removes entries marked `~~strikethrough~~` or `GRADUATED` or `OBSOLETE`

This replaces the current manual-only graduation pipeline.

#### Change 4: Coach Dedup Gate

Before Coach writes a new convention to an agent's LESSONS.md, the system should check:
- Does this convention already exist in `agents/shared/LESSONS.md`?
- If yes: skip the write, or write only an agent-specific example (max 1 line)
- If no: write to agent file, but flag for potential promotion to shared

This could be implemented as:
- A pre-write check in Coach's Growth Cycle prompt
- Or a JS handler that validates writes to LESSONS.md

#### Change 5: Dead Reference Cleanup

Immediate one-time cleanup:
- Remove all references to SIGNALS.md, todo.md, and other deleted infrastructure
- Remove all `~~strikethrough~~` entries (they still cost tokens)
- Remove all entries marked GRADUATED/OBSOLETE

---

## Implementation Plan

### Phase 1: Immediate (this session)
1. ✅ Write consolidated `agents/shared/LESSONS.md` with all universal conventions
2. Send to May: remove duplicated conventions from all individual LESSONS.md files
3. Send to May: clean dead references (SIGNALS.md, todo.md, strikethrough entries)

### Phase 2: Near-term (next 1-2 days)
4. ✅ Add LESSONS.md size budget headers to all agent files — DONE (Phase 1 included these)
5. Update Coach's Growth Cycle to check shared/LESSONS.md before writing
6. ✅ Add graduation audit cron job (daily, JS handler) — DONE 2026-03-17
   - Handler: `agents/may/handlers/lessons-graduation.ts` (259 lines, pure JS)
   - Cron entry: `lessons-graduation` in cron.json (24h interval)
   - Scans: size budget, stale entries, strikethrough, GRADUATED/OBSOLETE markers, shared duplicates
   - Outputs: `workspace/graduation-report.md`, triggers May heartbeat on issues

### Phase 3: Medium-term (next week)
7. Monitor LESSONS.md sizes — target all under 2,000 bytes
8. Review whether any remaining entries should graduate to DOMAIN.md or heartbeat.md
9. Consider whether LESSONS.md should be renamed to something that better communicates its temporary nature (e.g., `BAND-AIDS.md` or `ACTIVE-FIXES.md`)

---

## Expected Outcomes

| Metric | Before | Projected | **Actual (Phase 1)** |
|--------|--------|-----------|---------------------|
| Total LESSONS bytes | 67,648 | ~30,000 | **19,686 ✅** |
| shared/LESSONS.md bytes | 487 | ~3,500 | **4,079** |
| Avg agent LESSONS bytes | 5,557 | ~2,300 | **1,292 ✅** |
| Duplicated conventions | 6 (across 3-8 files) | 0 | **0 ✅** |
| Dead references | 4+ | 0 | **0 ✅** |
| Token waste per session | ~700 extra tokens | ~0 extra | **~0 ✅** |
| Files over 2K budget | 11 | ~4 | **2** (tech-lead, bob — agent-specific) |

---

## Files to Create/Modify

1. **`agents/shared/LESSONS.md`** — Expand with universal conventions (from draft at `shared-lessons-draft.md`)
2. **`agents/*/LESSONS.md`** (11 files) — Remove duplicated conventions, dead refs, graduated entries
3. **`agents/coach/DOMAIN.md`** or heartbeat — Add dedup gate instruction
4. **`agents/may/handlers/lessons-graduation.ts`** (Phase 2) — Automated graduation scanner
5. **`agents/may/cron.json`** (Phase 2) — Add daily graduation cron entry
