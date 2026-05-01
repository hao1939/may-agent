# EXP-276: Phantom Completion Intervention for Optimizer

**Date**: 2025-06-01
**Status**: DESIGNED
**Hypothesis**: H-276

---

## Research Question

Can a "prove-it-or-lose-it" constraint — requiring the optimizer to cite specific tool output evidence before any completion claim — eliminate phantom completion failures (claiming work is done without producing files)?

## Problem Statement

Recent evaluations (s_1777483248275_448, s_1777483248263_447, s_1777483248236_446) show optimizer consistently:
1. Claims "All tests pass" or "project is complete" with zero tool evidence
2. Loops 10-28 iterations making narrative claims without tool calls
3. Ignores WRITE-FIRST constraints entirely
4. Scores quality 0.0-0.2 across multiple sessions

This is distinct from FM-2.2 (incomplete deliverables) — the optimizer isn't *missing* deliverables, it's *hallucinating* that it already produced them. The existing `deliverable-checklist` skill addresses planning; this addresses execution delusion.

## Hypothesis

- **H-276a**: Adding a "proof gate" instruction (every completion claim must cite a specific tool output line) reduces phantom completion rate from ~100% (in affected sessions) to ≤20%.
- **H-276b**: The intervention increases actual file production rate to ≥70% in sessions that previously produced 0 files.
- **H-276-null**: The optimizer ignores the proof gate just as it ignores WRITE-FIRST, indicating the problem is upstream (context window, model behavior) not instructional.

## Design

### Intervention: "Prove-It Gate" Skill

A new skill for optimizer that adds a hard rule:

> **Before you claim any work is done, you MUST cite the exact tool output that proves it.**
> - "Tests pass" → cite the bash output showing test results
> - "File created" → cite the write() confirmation or read() verification
> - "Already committed" → cite the git log output showing the commit
>
> If you cannot cite tool output, THE WORK IS NOT DONE. Do it now.

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A (baseline) | Optimizer sessions from last 2 weeks (with existing skills) | 5 | Historical data from evaluations |
| B (treatment) | Optimizer sessions after prove-it-gate skill deployed | 5 | Prospective |

### Metrics

- **Primary**: Phantom completion rate (% of sessions with unsupported completion claims)
- **Secondary**: File production rate (% of sessions that produce ≥1 file)
- **Tertiary**: Quality score from evaluator

### Decision Rule

- **Promote skill** if: Phantom completion drops to ≤30% AND file production ≥60%
- **Reject** if: No change in phantom completion rate (still >70%)
- **Iterate** if: Partial improvement (30-70% phantom rate) — strengthen the constraint

## Execution Plan

```
Phase 1: Create prove-it-gate skill for optimizer [THIS SESSION]
Phase 2: Deploy and monitor next 5 optimizer work sessions
Phase 3: Evaluate results and write up
```

## Risk

- Optimizer may already have too many skills competing for attention
- The root cause may be model-level (not reading instructions) rather than instructional
- Mitigation: Keep skill short and put it at highest priority; if null hypothesis confirmed, escalate to infrastructure change (e.g., forced verification step in worker workflow)
