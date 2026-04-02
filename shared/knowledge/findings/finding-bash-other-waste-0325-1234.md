# Finding: bash:other Waste Decomposition & Reduction Plan

**Date**: 2026-03-25T12:34
**Category**: Cost & Efficiency / Tool Quality
**Severity**: Medium-High
**Impact**: 148 wasted tool calls/24h (69% of all waste)

## Problem

The tool quality scan's `bash:other` category is a catch-all bucket containing 148 wasted calls — 69% of the total 216 wasted calls across 4,500 total calls. Because it's unclassified, we can't target interventions.

**Agent breakdown:**
| Agent | bash:other count | % of agent's waste |
|-------|----------------:|-------------------|
| QA | 70 | 47% of total |
| Optimizer | 36 | 24% |
| Coach | 26 | 18% |
| Coder | 16 | 11% |

## Root Cause Analysis

### QA (70 calls — biggest source)
QA's heartbeat.md explicitly warns: "`npx`, `npm`, `tsc`, and `vitest` are NOT available in this runtime." But QA repeatedly runs `vitest --run` as a "mandatory gate" — then treats the environment failure as blocking evidence. The evaluator's ERROR_LOG shows **8 separate error entries** about `FM-2.1: OVER-STRICT_GATE` where QA treats environment failures as blocking despite patch-specific checks passing.

This is a **model compliance issue** — the instruction is in the prompt but the model ignores it under the pressure of its "mandatory test gate" conviction.

### Optimizer (36 calls)
Optimizer tries commands like `sqlite3` and `bun` that aren't available, then pivots. These are exploratory probes that could be avoided with better environment awareness in the prompt.

### Coach (26 calls)
Similar pattern to QA — trying npx/tsc for verification purposes.

### Coder (16 calls)
Mostly `cd /home/coder` type path errors (some overlap with bash:nonexistent-path).

## Proposed Fixes (3 layers)

### Fix 1: Improve Classifier (LOW COST, HIGH VISIBILITY)
Add sub-categories to `classifyFailure()` in `tool-quality-scan.ts`:
- `bash:cmd-not-found` — detect "command not found", "not found", exit code 127
- `bash:module-not-found` — detect "Cannot find module", "MODULE_NOT_FOUND"
- `bash:permission-denied` — detect "Permission denied", exit code 126

This breaks the 148-count blob into actionable categories for targeted intervention.

**Patch** (for `agents/may/handlers/tool-quality-scan.ts`):
```typescript
// Add before the final "return 'other'" in classifyFailure():
if (result.includes("command not found") || result.includes("not found") || rootCause.includes("exit code 127")) return "cmd-not-found";
if (result.includes("Cannot find module") || rootCause.includes("MODULE_NOT_FOUND")) return "module-not-found";
if (result.includes("Permission denied") || rootCause.includes("exit code 126")) return "permission-denied";
```

### Fix 2: Unavailable-Command Guard (MEDIUM COST, HIGH IMPACT)
Create a guard similar to path-assumption-guard that intercepts bash commands with known-unavailable commands (npx, npm, tsc, vitest, bun, sqlite3, pip, python3) and returns an error message explaining what IS available (node, git, grep, find, cat, etc.).

This would eliminate ~60-80 of the 148 bash:other calls.

**Location**: `src/lib/guards/unavailable-cmd-guard.ts`
**Activation**: Added to guard chain in tool handler

### Fix 3: QA Prompt Hardening (LOW COST, MEDIUM IMPACT)
Strengthen QA's heartbeat.md to make the vitest prohibition a HARD BLOCK rather than a warning. Move the "`npx`/`vitest` NOT available" note from a comment to a numbered step-0 pre-check, similar to the commit-preflight early exit check.

## Recommendation

1. **Now**: Send classifier improvement patch to tech-lead (Fix 1)
2. **Next session**: Draft unavailable-cmd-guard.ts (Fix 2) — similar to path-assumption-guard pattern
3. **Coaching**: Flag QA vitest waste pattern to coach for model behavior intervention (Fix 3)

## Cost Impact
- Fix 1: Visibility only (no direct cost reduction)
- Fix 2: Estimated 60-80 fewer wasted calls/day → ~$5-10/day savings
- Fix 3: Estimated 20-40 fewer wasted calls/day → ~$3-5/day savings
- Combined: ~$8-15/day savings, 30-50% waste rate reduction
