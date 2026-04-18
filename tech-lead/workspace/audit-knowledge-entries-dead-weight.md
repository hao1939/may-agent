# Audit: Knowledge Entries Dead Weight — Lens C

**Date**: 2026-04-13  
**Scope**: `agents/shared/knowledge/knowledge-index.json` (60 entries, 430 keywords)  
**Companion**: Lens D findings at `audit-knowledge-matching-fragility.md` (substring matching mechanics)

---

## Executive Summary

The knowledge index has grown from 19→60 entries but keyword quality hasn't scaled. **11 keywords ≤3 chars** cause substring false positives, **82 generic single-word keywords** match most task texts, and **6 thematic clusters** contain entries so similar they compete for the 3-slot injection limit. The net effect: relevant knowledge is displaced by near-duplicate or false-positive matches.

---

## Problem 1: Short Keywords (≤3 chars) — False Positive Generators

The matcher uses `normalizedTask.includes(kw)` (substring). Short keywords match inside unrelated words.

| Entry | Keyword | Len | False-match examples |
|-------|---------|-----|---------------------|
| KE-005 | `"QA"` | 2 | "s**qa**b" (rare but principle holds) |
| KE-010 | `"gym"` | 3 | Low risk — uncommon substring |
| KE-012 | `"lab"` | 3 | "col**lab**orate", "e**lab**orate", "**lab**el" |
| KE-019 | `"L5"` | 2 | Low risk — uncommon |
| KE-020 | `"use"` | 3 | "beca**use**", "ref**use**", "**use**r", "ca**use**" — **extremely common** |
| KE-053 | `"gym"` | 3 | (same as KE-010) |
| KE-053 | `"gap"` | 3 | Low risk |
| KE-054 | `"bug"` | 3 | "de**bug**" — common in dev tasks |
| KE-054 | `"fix"` | 3 | "pre**fix**", "af**fix**" — moderate risk |
| KE-109 | `"gym"` | 3 | (same as KE-010) |
| KE-109 | `"gap"` | 3 | Low risk |

**Highest risk**: `"use"` (KE-020) — this keyword matches virtually every English task description. Empirically confirmed: "Build user authentication" matches KE-020 via substring "use" in "user".

**Recommendation**: Remove or expand all ≤3 char keywords. Specifically:
- `"use"` → delete (covered by other KE-020 keywords: "capability", "adoption", "wiring")
- `"bug"` / `"fix"` → `"bug fix"`, `"fix bug"`, `"debugging"` 
- `"lab"` → `"lab fork"`, `"lab-fork"`
- `"QA"` → `"QA review"`, `"quality assurance"`
- `"L5"` → `"L5 gate"`, `"materialization gate"`
- `"gym"` → acceptable (low false-positive risk, uncommon substring)
- `"gap"` → `"gym-production gap"` or `"performance gap"`

---

## Problem 2: Generic Single-Word Keywords — Everything Matches Everything

82 keywords are common single words that appear in nearly any agent task. With substring matching, these create a "noise floor" where unrelated entries score 1+ just from incidental word overlap.

**Worst offenders** (appear in 4+ entries, match broadly):

| Keyword | Entries using it | Problem |
|---------|-----------------|---------|
| `"judgment"` | KE-002, KE-021, KE-031, KE-054, KE-061, KE-129 (6) | Any task mentioning "judgment" triggers 6 entries competing for 3 slots |
| `"guard"` | KE-004, KE-094, KE-106, KE-113, KE-136, KE-137 (6) | Same — guard-related queries get flooded |
| `"gate"` | KE-019, KE-060, KE-119, KE-129, KE-134, KE-135 (6) | |
| `"skill"` | KE-002, KE-006, KE-017, KE-018, KE-021, KE-061 (6) | |
| `"production"` | KE-053, KE-109, KE-110, KE-112, KE-113, KE-114, KE-136 (7) | 7 entries — guaranteed to displace niche matches |
| `"few-shot"` | KE-059, KE-060, KE-061, KE-132, KE-133 (5) | |
| `"workflow"` | KE-007, KE-015, KE-016 (3) | |
| `"verification"` | KE-022, KE-093, KE-097, KE-102 (4) | |
| `"behavioral"` | KE-002, KE-007, KE-018, KE-114 (4) | |
| `"exploration"` | KE-017, KE-022, KE-125, KE-133 (4) | |

**The displacement problem**: With `maxResults=3`, when a task mentions "production" all 7 production-keyword entries compete. The most relevant entry (e.g., KE-136 for a guard deployment task) may lose to KE-112 or KE-114 simply because those entries have more matching generic keywords.

**Empirical simulation results** (from testing 9 representative tasks):
- "Fix a bug in the production database" → 8 matches, top-3 are KE-054 (reasonable), KE-053, KE-109, KE-110 (all "production" noise)
- "Design a gate for quality verification" → **14 matches** — impossible to surface the right 3
- "Audit guard effectiveness in production" → **15 matches** — complete noise flood

**Recommendation**: Replace single-word keywords with 2-3 word phrases that are specific to the entry's unique insight:
- `"guard"` → `"guard brittle"`, `"commit guard"`, `"guard bifurcation"` etc. (make each entry's guard keyword unique)
- `"production"` → `"production evaluation"`, `"production gap"`, `"production transfer"` etc.
- `"judgment"` → `"judgment task"`, `"judgment skill"`, `"judgment domain boundary"` etc.

---

## Problem 3: Thematic Duplication — Entries That Say the Same Thing

Several clusters contain entries so thematically similar they consume multiple injection slots without adding new information:

### 3a. Gym-Production Gap: KE-053 + KE-109 (MERGE CANDIDATE)
- KE-053: "Gym-production gap is structural, not behavioral"
- KE-109: "Gym-production gap is structural across 5 dimensions"
- **4 shared keywords**: gym, production, gap, transfer
- **Assessment**: KE-109 subsumes KE-053 (adds the 5-dimension detail). KE-053 could be removed or merged.

### 3b. Verification Confabulation: KE-093 + KE-097 + KE-102 (PARTIAL OVERLAP)
- KE-093: defines the phenomenon
- KE-097: explains the root cause (confirmation bias)
- KE-102: provides the fix (evidence-over-narrative)
- **3 shared keywords**: verification, confabulation
- **Assessment**: These form a coherent chain (problem → root cause → fix). But they share enough keywords that a "verification" task gets all 3, leaving no slot for other relevant entries. Differentiate keywords so they don't all co-trigger.

### 3c. Guard Entries: KE-004, KE-094, KE-106, KE-113, KE-136, KE-137 (6 entries!)
- These cover guard brittleness, enforcement mechanism, non-training effect, recovery pattern, production transfer, and learner/reliant bifurcation
- **All unique insights**, but **6 shared "guard" keyword** means they ALL match any guard-related task
- **Assessment**: Don't merge, but differentiate keywords. Each entry should have a unique discriminating keyword that matches its specific concern.

### 3d. Externalization: KE-031 vs KE-054 vs KE-129 (CONTRADICTORY without context)
- KE-031: "domain-independent +69pp"
- KE-054: "sharp domain boundary — HURTS debugging"
- KE-129: "ONLY reliable channel for judgment"
- These **contradict each other** if injected without nuance. KE-031 says "universal", KE-054 says "not for debugging", KE-129 says "only for judgment". Injecting all 3 simultaneously would confuse agents.
- **Assessment**: KE-054 refined KE-031's claim. KE-031's oneliner should be updated to note the boundary, or KE-031 should be retired in favor of KE-054 + KE-129.

### 3e. Text Rules / Intervention Mechanisms: KE-002 + KE-007 + KE-060 + KE-101
- KE-002: text rules fail (0%)
- KE-007: workflows are the only intervention
- KE-060: taxonomy of 3 mechanisms
- KE-101: meta-analysis ranking
- **Assessment**: KE-101 subsumes KE-002 and KE-007. KE-060 adds the taxonomy. Could consolidate to KE-101 + KE-060.

---

## Problem 4: Internal Keyword Duplicates

Three entries have literal duplicate keywords:
- **KE-013**: `"scope"` appears twice
- **KE-019**: `"push back"` appears twice
- **KE-123**: `"combined"` appears twice

This inflates their match score by 1 point for free. While minor, it's data quality debt.

---

## Problem 5: Stale / Superseded Content

| Entry | Concern |
|-------|---------|
| KE-012 | "Lab-fork null-patch test confirms infrastructure validity" — one-time validation result, not actionable knowledge. No agent task would benefit from this injection. |
| KE-005 | "QA catches only 14% of issues" — this informed a design decision (removing QA step). The decision is made; the historical data point has no ongoing value for task injection. |
| KE-009 | "Negative examples in LESSONS.md have zero effect" — LESSONS.md may have been restructured/removed since. If LESSONS.md no longer exists, this entry is dead. |
| KE-010 | "Most gym scenarios hit ceiling" — superseded by KE-110 (skill stack saturation). |

---

## Priority Ranking

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 1 | Remove `"use"` keyword from KE-020 | High (prevents universal false positive) | Trivial |
| 2 | Differentiate generic keywords in 6-entry clusters (guard, judgment, production, gate, skill) | High (fixes displacement) | Moderate — ~30 keyword edits |
| 3 | Expand ≤3 char keywords to 2-word phrases | Medium (prevents substring false positives) | Small — 11 keywords |
| 4 | Merge KE-053 into KE-109, retire KE-053 | Medium (frees a slot) | Small |
| 5 | Update KE-031 oneliner to reflect KE-054 domain boundary | Medium (prevents contradictory injection) | Small |
| 6 | Remove stale entries (KE-012, KE-005, KE-009) | Low (frees slots, reduces noise) | Small |
| 7 | Fix internal duplicate keywords (KE-013, KE-019, KE-123) | Low (minor score inflation) | Trivial |

---

## Relationship to Lens D

Lens D identified the **mechanism** (substring matching, short keywords). This Lens C audit identifies the **scope**:
- 11 short keywords (Lens D found the same 11)
- 82 generic keywords (new finding — goes beyond Lens D's short-keyword focus)
- 6 thematic clusters causing slot competition (new finding)
- 4 stale entries (new finding)

Together, Lens C + D form a complete picture: the matcher is fragile (D) AND the keyword inventory is polluted (C).

[SIG: 1776111830:d4f8e2a1]
