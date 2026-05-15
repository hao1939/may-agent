# Finding: Tech-Lead Session Quality Patterns (Mode C Technique Scouting)

**Date**: 2026-04-18 ~16:30 UTC  
**Metric**: Tech-lead avg quality = 0.686 (primary drag on quality-preserved 0.892 vs 0.9 target)

## Summary

Sampled 10 low-quality tech-lead sessions (q ≤ 0.55). **Three repeating failure patterns account for ~90% of quality loss**, all in Lens work sessions (`kind=call`, avg q=0.714 vs `kind=job` heartbeats at q=0.76):

1. **Citation non-compliance** (9/10 sessions) — Deliverables lack required `path:line` citations despite D-o-R Phase 3 gate explicitly requiring them
2. **DB query failure chains** (6/10 sessions) — bun:sqlite queries fail from wrong schema assumptions or malformed scripts, wasting 2-4 ops per chain
3. **Scope drift / FM-2.6** (4/10 sessions) — Agent answers a different question than asked, or pivots topic without acknowledging the original task

## Detailed Pattern Analysis

### Pattern 1: Citation Failure (Systemic — 9/10 low-q sessions)

Every low-quality Lens session was dinged for missing `path:line` citations. The D-o-R template says "every non-trivial claim MUST carry an inline `path:line` citation" but the agent consistently writes findings with approximate references ("~line 200") or no citations at all.

**Examples**:
- `s_1776528383930_382` (q=0.35): "uses approximate references like `agents/may/cron.json:~line 200/280/170`"
- `s_1776508279527_111` (q=0.35): "uses self-referential citations like `priority-drift.ts:1-401` without showing that file was read"
- `s_1776521193037_265` (q=0.28): "zero path:line citations in the visible excerpt"

**Root cause**: The agent treats citation as optional documentation rather than a hard gate. It writes the finding first, then doesn't go back to add citations. The D-o-R template mentions citations in Phase 3 but doesn't enforce a verification step.

**Teachable fix**: Add a post-write citation audit step: "After writing, grep your deliverable for claims. Each must have `file.ts:123` format. Read files to get exact line numbers."

### Pattern 2: DB Query Failure Chains (6/10 sessions)

Agent guesses column names (e.g., `id` instead of `sessionId`), writes malformed bun -e scripts (unterminated strings, wrong quoting), then spends 2-4 ops recovering.

**Examples**:
- `s_1776517584598_213` (q=0.05): "Three initial DB queries failed due to wrong schema assumptions (`id` column does not exist)"
- `s_1776506480342_96` (q=0.32): "Three bash attempts failed due to malformed/truncated bun -e snippets"

**Root cause**: Agent doesn't run `PRAGMA table_info()` first (already in context.md but not followed). Also, complex bun -e one-liners are fragile — a missing quote kills the whole command.

**Teachable fix**: Already documented in context.md ("Defensive practice: run PRAGMA table_info first"). Compliance is the issue, not knowledge. Consider embedding a DB query template directly in the D-o-R Phase 2 prompt.

### Pattern 3: Scope Drift / FM-2.6 (4/10 sessions)

Agent investigates something adjacent but different from what was asked.

**Examples**:
- `s_1776513677868_160` (q=0.35): Asked "why did coder utilization drop today?" — answered "the baseline was a gym spike yesterday" (different question)
- `s_1776510063802_127` (q=0.35): Target file `evaluation-sync.ts` not found, silently pivoted to `evaluator-heartbeat.ts` without noting the mismatch

**Root cause**: Agent doesn't re-read the task prompt before writing the deliverable. After investigation reveals unexpected data, it writes what it found rather than what was asked.

**Teachable fix**: Add "Re-read task objective before Phase 3" to D-o-R template.

## High-Quality Session Characteristics

For contrast, the q=1.0 sessions (heartbeats) succeed because:
- **Tight scope**: Observe → decide → fork → finish. No deliverable to mess up.
- **No citation requirement**: Heartbeats don't write findings docs.
- **Clear protocol**: The heartbeat.md is very prescriptive about what to do.

The q=0.85 Lens session (`s_1776515506397_177`, stale projects audit) succeeded because:
- Read all 6 target files as instructed
- Produced finding with per-file verdicts as requested
- Had a minor filename mismatch but content was solid

## Verdict Distribution (all tech-lead sessions)

| Verdict | Count | Avg Quality |
|---------|-------|------------|
| good | 1,576 | 0.75 |
| acceptable | 907 | 0.50 |
| needs_improvement | 164 | 0.25 |

The 164 `needs_improvement` sessions at avg q=0.25 are the primary drag. Even moving half of these to `acceptable` (0.50) would shift the overall average from 0.686 to ~0.71.

## Recommendations (Ranked by Impact)

1. **[HIGH] Add citation verification step to D-o-R Phase 3** — After write, require: "Read back your deliverable. For each concrete claim without a `path:line` citation, add one now." This addresses 9/10 low-q sessions.

2. **[MEDIUM] Embed PRAGMA template in D-o-R Phase 2** — First DB query in any investigation should start with schema check. Reduces failure chains.

3. **[LOW] Add task-objective re-read before Phase 3** — "Before writing, re-read your original task. Confirm your finding answers the question asked, not a different question."

## NO_DISPATCH

These are prompt improvements to the lens-analysis workflow template, not code changes. Would need to edit the workflow definition — but per KE-002, text rules have 0% success for judgment failures. The citation issue may be structural (agent runs out of ops before citation pass) rather than behavioral. Need to check if op budgets are too tight for citation compliance.
