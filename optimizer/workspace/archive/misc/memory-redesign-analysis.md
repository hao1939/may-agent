# Agent Memory System Redesign Analysis
**Author**: Optimizer | **Date**: 2026-03-17 | **Status**: Draft

## Executive Summary

The current LESSONS.md system has a severe duplication problem costing ~16,900 tokens across 13 files, with major conventions duplicated 6-8x each. This analysis recommends consolidating shared conventions into `agents/shared/LESSONS.md` and keeping only agent-specific lessons in individual files.

---

## Problem 1: LESSONS.md Bloat Through Duplication

### Quantified Impact

| Convention | Files containing it | Bytes wasted (duplicated) |
|---|---|---|
| C26 (Claim-as-Record) | 8 of 13 files | ~10,841 bytes (~2,710 tokens) across 8 copies |
| C40 (Promise-Deliver-Report) | 7 of 13 files | ~9,400 bytes (~2,350 tokens) across 7 copies |
| C24 (Handoff Protocol) | 6 of 13 files | ~5,400 bytes (~1,350 tokens) |
| C23 (Escalation Protocol) | 4 of 13 files | ~3,600 bytes (~900 tokens) |
| C25 (3-3-3 Resource Budget) | 3 of 13 files | ~2,400 bytes (~600 tokens) |
| C22 (Progress Tracking) | 3 of 13 files | ~2,100 bytes (~525 tokens) |
| C30 (Safe File Appending) | 2 of 13 files | ~1,200 bytes (~300 tokens) |

**Total duplicated convention content**: ~35,000 bytes (~8,750 tokens) — that's **52% of all LESSONS.md content** is duplicate cross-agent conventions.

### Current System Prompt Sizes (SOUL + DOMAIN + TOOLS + LESSONS)

| Agent | Total bytes | ~Tokens | LESSONS % |
|---|---|---|---|
| tech-lead | 27,955 | 6,988 | 43% |
| optimizer | 26,634 | 6,658 | 25% |
| bob | 24,249 | 6,062 | 37% |
| evaluator | 23,501 | 5,875 | 28% |
| may | 21,659 | 5,414 | 48% |
| scout | 17,108 | 4,277 | 28% |
| coach | 14,618 | 3,654 | 23% |
| qa | 14,365 | 3,591 | 5% |
| amy | 13,660 | 3,415 | 41% |
| amy-kimi | 13,056 | 3,264 | 31% |
| coder | 11,341 | 2,835 | 19% |
| master | 10,771 | 2,692 | 13% |

### Root Cause

The coaching system (Coach + Optimizer) adds conventions to individual LESSONS.md files one-at-a-time when failures are detected per-agent. Conventions like C26 (Claim-as-Record) and C40 (Promise-Deliver-Report) are fundamentally universal — they apply to all agents — but get copied into each agent's file individually.

The `agents/shared/LESSONS.md` file exists but has only 487 bytes (3 rules). Meanwhile, 8,750 tokens of duplicated conventions sit in individual files.

---

## Problem 2: LESSONS.md Graduation Stalls

### Design vs. Reality

**Design**: LESSONS.md is a "staging area" — entries should "graduate into structure (heartbeat.md, DOMAIN.md, SOUL.md) within 2 weeks, then be deleted."

**Reality**: Many entries have been in LESSONS.md for weeks. The graduation mechanism depends on:
1. Coach noticing an entry is old enough to graduate
2. Coach (or Optimizer) figuring out WHERE to put it
3. May executing the cross-file edit

This pipeline rarely completes. Evidence:
- C26 was "added H657/H671" — it's been in active band-aids across 8 files for weeks
- C40 was added at various heartbeats — still duplicated across 7 files
- C23 was "added H655" — still active across 4 files
- QA's LESSONS.md is the model: all entries graduated, file is just 729 bytes

### Impact of Non-Graduation

1. **Context budget waste**: Each agent carries ~1,500-3,500 extra tokens of LESSONS content
2. **Inconsistency**: Same convention has slightly different wording per agent (agent-specific examples add value but core rule shouldn't vary)
3. **Maintenance burden**: When a convention is updated, it must be updated in 6-8 places

---

## Recommendations

### R1: Consolidate Universal Conventions into `agents/shared/LESSONS.md`

Move these conventions to `agents/shared/LESSONS.md` (already auto-loaded for all agents):

| Convention | Action |
|---|---|
| C26 (Claim-as-Record) | Move to shared. Each agent keeps only agent-specific examples. |
| C40 (Promise-Deliver-Report) | Move to shared. Template is identical across all. |
| C24 (Handoff Protocol) | Move to shared. Core protocol is universal. |
| C23 (Escalation Protocol) | Move to shared. 4-tier ladder is universal. |
| C25 (3-3-3 Budget) | Move to shared. Rule is universal. |
| C22 (Progress Tracking) | Move to shared. Rule is universal. |

**Expected savings**: ~7,000-8,000 tokens freed across the system (~700 tokens per agent on average).

### R2: Keep Only Agent-Specific Entries in Individual LESSONS.md

After consolidation, individual LESSONS.md files should contain ONLY:
- **Agent-specific failure patterns** (e.g., evaluator's Self-Reference Prevention, Amy's ENOENT handling)
- **Agent-specific examples** of shared conventions (brief, 1-2 lines max)
- **Graduated section** tracking what moved where

### R3: Implement Graduation Automation

Add to Optimizer's periodic tasks: "LESSONS.md graduation audit" — identify entries older than 2 weeks and either:
1. Move to shared/LESSONS.md if universal
2. Graduate to heartbeat/DOMAIN/SOUL/TOOLS if agent-specific-but-stable
3. Delete if obsolete

### R4: Add Duplication Detection to Coach's Growth Cycle

Before Coach writes a new LESSONS.md entry, check if the same convention already exists in `agents/shared/LESSONS.md`. If so, either skip (convention already taught) or add only agent-specific examples.

---

## Implementation Plan

### Phase 1: Consolidate Shared Conventions (can be done now)

1. Draft new `agents/shared/LESSONS.md` with C26, C40, C24, C23, C25, C22
2. Send to May for execution (cross-agent file edits)
3. Remove duplicates from individual LESSONS.md files

### Phase 2: Graduate Stale Entries

1. Review all "Active Band-Aids" entries for graduation readiness
2. Move stable entries to their structural homes
3. Target: each agent's LESSONS.md under 2,000 bytes

### Phase 3: Prevent Recurrence

1. Add graduation audit to optimizer periodic tasks
2. Update coach's growth cycle to check shared LESSONS first
3. Add convention dedup check to the coaching pipeline

---

## Appendix: Per-Agent Unique Lessons (worth keeping per-agent)

- **evaluator**: Scoring Protocol, Self-Reference Prevention, Transcript Evidence Accuracy
- **coach**: Learning Filter (Partial vs Total Failures), Growth Cycle Completion
- **amy**: ENOENT handling, Task Ledger Integrity, Research Protocol
- **amy-kimi**: Urgency-Override Resistance, XHS Operations, Safe File Appending
- **may**: Dispatch Before Health Checks, System Busy Pivot, Spawn Dispatch-Only Agents, No Re-Cancellation Waste
- **bob**: Idempotent Handoffs, Idempotent Self-Work, Write-Before-Send Sequencing
- **scout**: Context Budget (72K hard ceiling), Save Early (3x FAIL), Scrape Limits
- **coder**: P104 Calibration, AgentMessage.isError unreliable
- **master**: Tool Availability (exit 127), Prompt Engineering tips
- **tech-lead**: Three Rules That Waste Most Turns, Verify Paths
- **optimizer**: Tool Argument Swap (C39), P53 Guard Recovery, Cross-Agent File Edits
- **qa**: (all graduated — model agent for LESSONS.md cleanliness)
