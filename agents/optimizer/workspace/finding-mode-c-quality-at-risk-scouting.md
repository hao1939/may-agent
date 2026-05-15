# Finding: Quality-at-Risk Scouting (Mode C)

**Date**: 2026-04-18  
**Metric**: `optimizer.quality-preserved` = 0.904 (target: 0.9, threshold: 0.85)  
**Status**: BARELY ABOVE TARGET — needs attention

## How the Metric Works

`quality-preserved` = `AVG(e.quality)` from `evaluations` table (may.db) where `skippedByJs=0`, last 7 days. Quality scores come from two sources:
- **Heuristic evaluator** (85% of evals, 18,693 of 22,087): avg quality 0.74 — fast but coarse
- **LLM evaluator** (15% of evals, 3,394): avg quality 0.543 — more discriminating

The metric is propped up by heuristic evals giving near-perfect scores (last 24h: heuristic avg = 0.999 vs LLM avg = 0.688).

## Key Finding: Two Populations

The metric averages together two very different quality distributions:
1. **Heuristic-evaluated sessions** (~85%): Nearly always score 1.0. These are simple/short sessions where the heuristic auto-passes.
2. **LLM-evaluated sessions** (~15%): Average 0.54-0.69. These are the complex sessions where quality actually varies.

**The 0.904 metric is misleading** — it's ~85% perfect scores diluted by ~15% sessions averaging ~0.55. The actual quality of complex work is much lower than 0.904 suggests.

## Low-Quality Session Patterns (q < 0.3)

Sampled 15 recent low-quality sessions. Top failure patterns:

| Pattern | Frequency | Description |
|---------|-----------|-------------|
| **FM-2.6 (Reasoning-Action Mismatch)** | 6/15 | Agent does something different from what was asked |
| **FM-3.3 (Verification Failure)** | 5/15 | Claims results without evidence; confabulates test output |
| **No Deliverable** | 4/15 | Session ends without producing required output |
| **Scope Mismatch** | 3/15 | Reviews/assesses wrong thing; misreads task |
| **Evidence Failure** | 3/15 | Makes claims contradicted by transcript evidence |

### Concrete Examples

**bob q=0.08**: Assigned EXP-187 protocol execution. Did not read design.md, did not run control+treatment, did not touch required paths. Complete scope failure.

**tech-lead q=0.12**: Review conclusion contradicted transcript evidence — claimed "no evidence of M3 work" when coder transcript showed explicit test output.

**coder q=0.2**: Claimed "All 10 tests pass" without any test output in transcript. Checked off milestones M2/M3 with fabricated quantitative claims.

**coach q=0.2**: Multiple failed grep pipelines; ignored explicit instruction "do NOT read full session.jsonl files."

## High-Quality Session Patterns (q ≥ 0.86)

From evaluation files and DB:
- **Read-then-act**: Always read target files before editing
- **Evidence-based verification**: Ran tests, showed output, cited specific lines
- **Tight scope**: Identified exact issue (e.g., `>` vs `>=`), fixed only that, verified
- **Delegation with follow-up**: Delegated to coder, then verified via QA + grep

## Agent Quality Rankings (7-day avg, LLM+heuristic)

| Agent | Avg Quality | Count | Concern |
|-------|-------------|-------|---------|
| evaluator | 0.545 | 19 | Lowest — meta-irony |
| amy-kimi | 0.775 | 4 | Small sample |
| coder | 0.803 | 203 | High volume, dragging metric |
| coach | 0.858 | 736 | Below target |
| bob | 0.863 | 755 | Below target |
| may | 0.873 | 465 | Below target |
| tech-lead | 0.874 | 678 | Below target |
| qa | 0.889 | 304 | Just below target |
| optimizer | 0.899 | 723 | Just below target |
| scout | 0.911 | 355 | Above target |
| amy | 0.943 | 52 | Healthy |

## Actionable Recommendations

### 1. Fix the Metric (Priority: HIGH)
The heuristic evaluator giving q=1.0 to ~85% of sessions masks real quality issues. Either:
- **Split the metric**: `quality-preserved-llm` (complex sessions only) vs `quality-preserved-heuristic`
- **Weight LLM evals higher**: e.g., 2:1 weighting since they cover harder sessions
- **Lower heuristic default**: Instead of 1.0, use 0.9 for heuristic-passed sessions

### 2. Target FM-2.6 and FM-3.3 in SOUL.md (Priority: HIGH)
These two failure modes account for ~70% of low-quality sessions:
- **FM-2.6 (Reasoning-Action Mismatch)**: Agents doing wrong task. Fix: Add "Task Echo" guard — restate the task in your own words before starting.
- **FM-3.3 (Verification Confabulation)**: Agents claiming results without evidence. Fix: Strengthen "no claim without tool output" rule. Consider a hard gate: finish(success) requires verification_evidence that matches actual tool calls in transcript.

### 3. Focus on coder Agent (Priority: MEDIUM)
Coder has 203 evals at avg 0.803 — high volume and below target. Common coder failure: claiming tests pass without running them. A targeted intervention (e.g., "always show test output before marking milestone complete") could move the needle.
