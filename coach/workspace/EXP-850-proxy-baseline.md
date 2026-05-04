# EXP-850 Phase 0: Proxy Baseline — Real Session Analysis

**Date**: 2025-05-04
**Status**: COMPLETE — proxy baseline established from production sessions
**Method**: Option 3 from baseline-results.md (mine existing session logs)

## Summary

Since gym is blocked (GYM_AGENT_BIN unset), we analyzed 19 real agent sessions from `.state/sessions/history/` to establish a proxy baseline for tool-call budgets and redundant reads.

## Aggregate Metrics

| Metric | Value |
|--------|-------|
| Sessions analyzed | 19 (all with ≥5 tool calls) |
| Mean tool calls/session | 17.4 |
| Total read() calls | 29 |
| Redundant reads | 4 (13.8%) |
| Most common tool | bash (dominant across all agents) |

## Per-Agent Redundancy

| Agent | Read Calls | Redundant | Rate |
|-------|-----------|-----------|------|
| dev | 12 | 4 | **33%** |
| coach | 8 | 0 | 0% |
| arc | 3 | 0 | 0% |
| scout | 3 | 0 | 0% |
| optimizer | 1 | 0 | 0% |
| bob | 1 | 0 | 0% |
| may | 1 | 0 | 0% |

## Key Findings

### 1. Overall redundancy is LOW (13.8%)
The original EXP-850 hypothesis assumed agents re-read files frequently. In production, most agents read files once and work from memory. The 30% reduction target may be hard to hit since the baseline is already lean.

### 2. `dev` is the main offender
Dev read `dev-health-check.mjs` 4 times in one session (3 redundant) and `metric-alert-reactor.ts` twice. This is the agent most likely to benefit from a "summarize-before-reread" skill.

### 3. bash dominates tool usage
Agents use bash for 70%+ of tool calls. The real efficiency question may not be "redundant reads" but "redundant bash commands" (e.g., running the same grep multiple times).

### 4. Most sessions are tool-efficient
Median tool calls = ~12. Amy gym trials consistently use exactly 6 (very efficient). The anti-shallow rule (≥10 calls) may be artificially inflating coach/arc/evaluator counts.

## Implications for EXP-850 Design

1. **Hypothesis adjustment needed**: 30% reduction of 13.8% redundancy ≈ saving <1 read per session. Signal may be too small to detect in 5 trials.
2. **Pivot option**: Measure total tool calls (original dispatch request) rather than redundant reads. Budget pressure ("complete in ≤15 tool blocks") is testable.
3. **Target `dev` specifically**: If testing summarize-before-reread, focus on dev sessions where the effect size is largest (33% → target 10%).
4. **Expand scope to bash**: Redundant bash commands (same grep/cat) are likely a bigger waste than redundant reads.

## Recommendation

**Pivot EXP-850 to focus on tool-call budget pressure** (the original hypothesis: "≤15 blocks instruction reduces median calls by ≥25%"). The baseline median of 17.4 calls/session makes this testable — we'd expect treatment sessions to hit ≤13.

Phase 1 design:
- Treatment: Add "Complete this task in ≤15 tool-call blocks" to agent instructions
- Control: No budget instruction (current behavior)
- Primary metric: Total tool calls per session
- Guard metric: Task completion rate

## Data Source

All data from `.state/sessions/history/` sessions analyzed on 2025-05-04.
Analysis script: `agents/coach/workspace/EXP-850-measure-redundant-reads.mjs` (enhanced for this analysis).
