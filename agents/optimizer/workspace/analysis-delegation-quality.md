# Delegation Quality Analysis: 0.71 → 0.85 Target

**Date**: 2026-04-23  
**Current Score**: 0.71 (system-wide avg quality on delegated work)  
**Target**: 0.85  
**Gap**: 0.14 points

## What's Driving the Gap

### Data Sources Examined
- `.state/delegations.jsonl` (1,289 delegation records)
- `.state/delegation-quality-analysis.md` (prior baseline)
- `H-014` hypothesis (call vs job quality gap)
- `finding-delegation-quality-drivers.md` (tech-lead lens, Apr 18)
- `delegation-quality-baseline.md` (May's measurement, Mar 30)
- Evaluator scoring rubric and failure patterns

---

## Worst Delegation Routes (by success rate)

| Route | Total | Success | Error | Rate |
|-------|-------|---------|-------|------|
| **may→bob** | 3 | 1 | 2 | **33%** |
| **may→tech-lead** | 13 | 6 | 7 | **46%** |
| **bob→tech-lead** | 28 | 15 | 13 | **54%** |
| **bob→optimizer** | 63 | 43 | 20 | **68%** |
| **bob→coach** | 10 | 7 | 3 | **70%** |

The **may→tech-lead** and **bob→tech-lead** routes are the highest-volume failure paths. Tech-lead as a delegation *receiver* has systemic issues — 46-54% success rate from its two biggest callers.

## Three Root Causes (ranked by impact)

### 1. Context Evaporation in Delegation Chains (52% of ops wasted)
**Evidence**: May's baseline measurement found **52.1% of delegate ops are spent rediscovering context** the delegator already knew. Zero delegations passed `context_files`. Average task description: 487 chars with 63-char context (just file paths, no content).

**Example**: May reads a file → sends 500 chars to tech-lead → tech-lead spends 8 ops re-reading the same file → delegates to coder → coder spends 6 more ops re-reading = **14 ops wasted per chain**.

**Impact on quality**: Agents running out of budget mid-task because they burned half their ops on discovery → incomplete work → low scores.

### 2. Call Sessions Get Dramatically Worse Quality Than Job Sessions
**Evidence** (H-014, 1,204 sessions over 7 days):

| Agent | Call Good% | Job Good% | Gap |
|-------|-----------|-----------|-----|
| optimizer | 38.5% | 89.3% | **-50.8pp** |
| coach | 42.2% | 81.3% | **-39.1pp** |
| tech-lead | 33.3% | 66.7% | **-33.4pp** |
| QA | 100% | 89.9% | +10.1pp |

QA is the **only** agent that performs better on delegated work — because QA gets bounded, verifiable tasks ("review this code"). Hub agents get open-ended judgment tasks ("diagnose this pattern") that degrade in delegation.

### 3. Heuristic Evaluator Inflates Scores, Masking True Quality
**Evidence** (finding-delegation-quality-drivers, Apr 18):
- Heuristic evals: avg quality **0.997** (44% of evals)
- LLM evals: avg quality **0.647** (56% of evals)
- Blended: 0.80 — but the "real" quality is closer to **0.65**

The 0.71 system-wide number is already partially inflated. The true delegation quality for LLM-assessed sessions is likely **0.60-0.65**.

---

## Top 3 Actionable Fixes

### Fix 1: Inline Context in Delegations (Est. impact: +0.06-0.08)
**What**: When delegating, paste the 20-50 most relevant lines of code/error into the task description instead of just naming file paths. Pass `context_files` with actual file paths so the framework can inject them.

**Why it works**: Cuts the 52% discovery waste roughly in half. Agents start working immediately instead of spending 8-14 ops rediscovering what the caller already knew. Directly addresses the #1 cause of budget exhaustion → incomplete work → low scores.

**How to implement**: 
1. Update May's delegation template to require inline code snippets for any file mentioned
2. Update tech-lead's coder dispatch to include the relevant source code in the task description
3. Enforce `context_files` population in the delegation workflow

### Fix 2: Convert Open-Ended Delegations to Bounded Verification Tasks (Est. impact: +0.04-0.06)
**What**: Instead of delegating "diagnose this error pattern" (open-ended judgment), delegate "check if [specific pattern] matches in [specific file], return yes/no with evidence" (bounded verification).

**Why it works**: QA achieves 100% quality on delegated work because its tasks are bounded and verifiable. Coach/optimizer/tech-lead fail on open-ended judgment tasks delegated via workflow calls (33-42% good rate). Converting judgment → verification closes the gap.

**How to implement**:
1. Identify the 5 most common open-ended delegation types in workflows
2. Rewrite each as a structured checklist with specific success criteria
3. Keep open-ended judgment in autonomous (job) sessions where agents excel

### Fix 3: Recalibrate Heuristic Evaluator (Est. impact: +0.02 real, -0.05 reported)
**What**: The heuristic evaluator scores 0.997 avg vs LLM's 0.647 — it's too generous. Recalibrate it to align with LLM scoring, or split the metric to report heuristic and LLM scores separately.

**Why it works**: The current blended score masks the true quality gap. Honest measurement is a prerequisite for knowing if fixes 1-2 are working. Without this, you can't tell if quality improved or if you just got more heuristic evals in the sample.

**How to implement**:
1. Add stricter checks to heuristic evaluator (verify deliverables exist, check for verification evidence)
2. Report `delegation-quality-llm` and `delegation-quality-heuristic` as separate metrics
3. Use LLM-only score as the primary quality signal

---

## Expected Outcome

| Fix | Current | After | Notes |
|-----|---------|-------|-------|
| Inline context | 0.71 | ~0.77 | Cuts discovery waste, more complete deliverables |
| Bounded tasks | 0.77 | ~0.82 | Closes call-vs-job gap for hub agents |
| Eval recalibration | 0.82 | ~0.83 honest | Removes inflation, enables accurate tracking |

Reaching 0.85 likely requires all three fixes plus continued iteration on the worst routes (may→tech-lead, bob→tech-lead).
