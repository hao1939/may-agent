# Finding: High-Op Session Archaeology — May 146-op & Tech-Lead 108-op

**Date:** 2026-04-16  
**Mode:** A (Session Archaeology)  
**Analyst:** Optimizer

---

## Executive Summary

Investigated the two highest-op sessions in the last 6 hours:
1. **May 146-op** (`s_1776277405256_19`) — "Guard Escalation: Don't Weaken Guards" — a multi-task conversational session that produced two design documents. **Status: idle (still alive), 146 ops, $2.22**
2. **Tech-lead 108-op** (`s_1776277963790_29`) — "P0: Investigate Evaluator quality=0.00 Bug (IT-28)" — a bug investigation and fix session. **Status: done, quality 1.0, 108 ops, $3.54**

**Key finding:** Both sessions are **productively high-op** — unlike previous archaeology targets (coach 166-op = 6 restarts, coder 104-op = false positive). These sessions produced substantial deliverables proportional to their cost. The waste patterns are different: not spirals or restarts, but **scope expansion** (May) and **defensive verification** (tech-lead).

---

## Session 1: May 146-op — Guard Escalation Design

### Profile
| Metric | Value |
|--------|-------|
| Session ID | `s_1776277405256_19` |
| Agent | may |
| Status | idle (still alive) |
| Op count | 146 (192 receipts including retries) |
| Cost | $2.22 |
| Input tokens | 697,184 |
| Output tokens | 8,762 |
| Duration | ~2h+ |

### Tool Breakdown
| Tool | Count | % |
|------|-------|---|
| bash | 130 | 67.7% |
| read | 23 | 12.0% |
| agents | 20 | 10.4% |
| edit | 13 | 6.8% |
| write | 3 | 1.6% |
| finish | 2 | 1.0% |
| checkpoint | 1 | 0.5% |

### What It Did

This was a **conversational session** (human-triggered, not heartbeat). Hao asked May to correct a guard escalation design where guards were being weakened instead of strengthened. The session produced:

1. **Review-gate.md redesign** (5 edits) — Simplified gatekeeper to three complementary modes (A: workflow guard, B: session-end subscriber, C: design review). Committed to main via `dfcf39e0`.
2. **Metric tension pairs design** (1 write) — A 330-line design document proposing productive conflict metrics between agent pairs (Bob↔Tech-lead, Coach↔Optimizer). Committed via `2f11dc15`.

### Waste Analysis

**Scope expansion** is the primary cost driver. What started as a guard escalation correction expanded into:
- Reading all 5 agent SOULs to understand tension pairs
- Querying the metrics system (metrics-system.md, metrics-evolution-roadmap.md, bob's unified-metric-system-design.md)
- Multiple DB queries to understand current metric state
- Creating a branch (`review/metric-tension-pairs`) with git stash/pop dance

**The 130 bash calls** break down roughly:
- ~25 git operations (commits, branches, stash/pop)
- ~30 grep/read for context gathering (SOUL.md analysis, metrics exploration)
- ~15 DB queries (metrics state, evaluation data)
- ~20 validation (wc -l, grep confirmation checks)
- ~40 misc (cd, echo, file listing)

**Git operations were notably messy** — stash/pop/checkout/branch sequences that could have been streamlined.

### Productivity Assessment

**Verdict: Moderate waste, high output.** The session produced two substantial design documents that were both committed to main. The cost ($2.22) is reasonable for 330+ lines of design work plus a redesign of the review-gate system. However:

- **~30% of ops were context gathering** that could have been avoided with better upfront task scoping
- **The scope expansion from "fix guard escalation" → "design metric tension pairs" was unplanned** — the metric-tension-pairs doc emerged from exploring agent SOULs for the guard fix
- **Git operations (~25 ops)** include retry patterns (stash/pop/branch dance) that waste 5-10 ops

**Estimated waste: ~30-40 ops (20-27%)** — mostly context gathering and git fumbling.
**This is a different pattern from previous findings** — not restart accumulation or spirals, but productive exploration that generates real artifacts.

---

## Session 2: Tech-Lead 108-op — Evaluator quality=0.00 Bug

### Profile
| Metric | Value |
|--------|-------|
| Session ID | `s_1776277963790_29` |
| Agent | tech-lead |
| Status | done |
| Quality | 1.0 |
| Op count | 108 (133 receipts including retries) |
| Cost | $3.54 |
| Input tokens | 1,117,540 |
| Output tokens | 12,460 |
| Duration | ~1h+ |

### Tool Breakdown
| Tool | Count | % |
|------|-------|---|
| bash | 104 | 78.2% |
| read | 23 | 17.3% |
| edit | 4 | 3.0% |
| finish | 2 | 1.5% |
| checkpoint | 1 | 0.8% |

### What It Did

P0 bug fix: evaluator's quality=0.00 was dragging the system quality.system metric from ~0.94 to 0.68. The session:

1. **Root-caused the bug**: `evaluation-sync` cron handler inserted quality=0, verdict="skipped" rows for evaluator sessions → quality.system average included them
2. **Fixed evaluation-sync.ts**: Added `agent != 'evaluator'` filter to skip evaluator's own sessions (3 edits)
3. **Fixed evaluator.ts**: Excluded skipped evaluations from quality averages (1 edit)
4. **Verified**: Ran test suite, DB queries before/after, type checks
5. **Committed**: To `review/fix-eval-zero-quality` branch + updated federation heartbeats

### Waste Analysis

**Defensive verification** is the primary cost driver. The actual fix was 4 edits (small code changes). But the session spent massive effort on:

**Phase 1 — Investigation (ops 1-35, ~35 ops)**
- Grepped for `quality.system` across entire codebase
- Read evaluation-sync.ts at 3 different offsets
- 5+ DB queries to understand the data
- Read metrics-snapshot handler, requests.ts
- **Verdict: Proportional.** Bug investigation requires reading and querying. ~35 ops for root cause is reasonable for a complex data flow bug.

**Phase 2 — Fix (ops 36-45, ~10 ops)**
- 3 edits to evaluation-sync.ts
- 1 edit to evaluator.ts
- **Verdict: Efficient.** Minimal ops for the actual fix.

**Phase 3 — Verification (ops 46-108, ~63 ops)**
- Multiple test suite runs (some failed on unrelated tests → `--grep-invert` retry patterns)
- `bun build` attempts to type-check (3 variations until finding one that worked)
- DB queries to verify the fix
- `git diff` to review changes
- Commit + branch operations
- Multiple finish() calls (first one appears to have issues, retried)
- **Verdict: 50-60% of this phase was waste.** Specifically:
  - **Test suite retries (~15 ops)**: Ran full tests, hit unrelated failures, had to figure out `--grep-invert` / `--test-name-pattern` flags. A known-good test command would save these.
  - **Build command fumbling (~8 ops)**: `bun build --no-bundle` doesn't type-check the way expected. Three attempts.
  - **Finish retries (~6 ops)**: Called finish(), then had to do git operations, then finish() again twice.
  - **Redundant DB queries (~5 ops)**: Re-queried the same data multiple times during verification.

**Estimated waste: ~35 ops (32%)** — mostly in the verification tail.

### Productivity Assessment

**Verdict: Good session, significant verification overhead.** The bug fix itself was high-quality (quality score 1.0) and the investigation was thorough. But 63 ops for verification of a 4-edit fix is disproportionate.

**Cost per edit: $0.89/edit and 27 ops/edit.** Compare to typical coder sessions: ~5-10 ops/edit.

---

## Cross-Session Patterns

### Pattern 1: Verification Tail (Tech-Lead)
The tech-lead spent 58% of the session (63 of 108 ops) on verification and commit operations. This matches a recurring pattern: **agents don't know the right verification commands upfront** and fumble through multiple attempts.

**Concrete waste:**
- `bun test --bail` → fails on unrelated test → `bun test --bail --grep-invert "steers"` → wrong flag → `bun test --bail --test-name-pattern "^(?!.*steers)"` → finally works
- `bun build --no-bundle src/lib/evaluator.ts --outdir /tmp/check` → wrong invocation → retry → retry → give up → `bun --eval 'import ...'`

**Fix opportunity:** A `verify-changes.sh` script that runs: (1) tsc --noEmit on changed files, (2) relevant tests (auto-detected from changed files), (3) diff summary. Would save ~15-20 ops/session for fix-type tasks.

### Pattern 2: Scope Expansion (May)
May's session morphed from "fix guard escalation" to "design metric tension pairs" — a classic productive scope expansion. The session didn't waste ops; it just did more work than the original task specified.

**Not a bug, but an architectural observation:** Conversational sessions with May are inherently open-ended. The human interaction pattern ("here's a correction" → May explores → discovers related work → produces design doc) creates high-op sessions that are productive but hard to budget.

### Pattern 3: Git Operations Overhead
Both sessions spent significant ops on git:
- May: ~25 ops (stash/pop/checkout/branch/commit)
- Tech-lead: ~10 ops (diff/status/add/commit/branch)

**Combined: ~35 ops on git across 2 sessions.** The stash/pop dance is particularly wasteful — agents struggle with dirty working trees.

### Pattern 4: Token Economics
| Metric | May | Tech-Lead |
|--------|-----|-----------|
| Cost | $2.22 | $3.54 |
| Ops | 146 | 108 |
| $/op | $0.015 | $0.033 |
| Input tokens | 697K | 1.12M |
| Output tokens | 8.8K | 12.5K |
| Input/output ratio | 79:1 | 90:1 |

Tech-lead costs **2.2× more per op** despite fewer ops. This is the **context accumulation tax** — each successive tool call in a debugging session re-sends the entire conversation. By op 108, the tech-lead is sending 10K+ tokens of context per call. The May session mitigates this somewhat through compaction (visible in the transcript) but still accumulates.

---

## Comparison with Previous Findings

| Session | Ops | Waste% | Waste Type | Root Cause |
|---------|-----|--------|------------|------------|
| Coach 166-op | 166 | ~75% | Restart accumulation | 6 restarts, discovery overhead ×6 |
| Coder 104-op | 104 | ~95% | False positive | Fewshot regex bug, zero output |
| **May 146-op** | **146** | **~25%** | **Scope expansion** | **Productive exploration, git fumbling** |
| **Tech-lead 108-op** | **108** | **~32%** | **Verification tail** | **Test/build command fumbling** |

**These two sessions represent a different class of high-op session:** productive work with moderate overhead, not catastrophic waste. The fix opportunities are incremental (better test commands, git helpers) rather than structural (restart caps, regex fixes).

---

## Actionable Recommendations

### 1. Verification Script (saves ~15 ops/session for fix tasks)
A `scripts/verify-changes.sh` that:
- Auto-detects changed .ts files
- Runs `tsc --noEmit` (or `bun --eval 'import ...'`) on them
- Finds and runs relevant test files
- Shows diff summary
This eliminates the "fumble through build/test commands" pattern seen in the tech-lead session.

**Priority:** P2 — affects ~5-10 sessions/day, ~75-150 ops saved.

### 2. Git Workflow Helper (saves ~5-10 ops/session)
A `scripts/review-branch.sh <session-id>` that:
- Stashes if dirty
- Creates/checks out review branch
- Stages relevant files
- Commits with standard message
This eliminates the stash/pop/branch dance.

**Priority:** P2 — affects ~10-15 sessions/day, ~50-150 ops saved.

### 3. No immediate structural changes needed
Both sessions were productive. The waste is moderate and the sessions achieved their goals. The verification and git helpers are quality-of-life improvements, not critical fixes.

---

## Summary

- **May 146-op**: Productive design session. Produced review-gate redesign + metric-tension-pairs design (330+ lines). ~25% waste from context gathering and git operations. Not a problem session.
- **Tech-lead 108-op**: Productive bug fix with quality 1.0. Found and fixed P-eval-zero bug. ~32% waste from verification tail (test/build command fumbling). The verification script recommendation applies here.
- **Overall**: These high-op sessions are categorically different from the restart-accumulation and false-positive patterns found previously. The system's worst waste patterns (restarts, fewshot bugs) have been addressed. The remaining waste is moderate overhead on productive work.
