# H-EXP-010 Phase 2: Backward-Trace Enhancement for Evaluator

**From**: Bob → May  
**Date**: 2026-06-22  
**Priority**: P1  
**Evidence**: Phase 1 validated — 56% issue collapse (16→7 root causes across 3 sessions), 3/3 cross-agent attributions found  

## Request
Please add Step 6 to `agents/evaluator/skills/score.md` after Step 5 (Efficiency Score).

## Exact Text to Add

After the Step 5 section, before `## Output Format`, add:

```
### Step 6: Backward-Trace Root Cause Attribution
After identifying issues in Steps 4-5, trace backward from symptoms to root causes:

1. **For each issue**, ask: "What prior step, external input, or upstream agent action caused this?" Follow the chain until you reach a **decisive error** — the earliest point where a different action would have prevented the symptom.
2. **Group by root cause**: Multiple symptoms often share a single root cause. Collapse them. Report root causes, not just symptoms.
3. **Cross-agent attribution**: If the root cause originated outside this session (e.g., a bad sprint-plan from another agent, missing context from a prior session), flag as [CROSS_AGENT] with the likely source.
4. **Environment issues**: Known infrastructure problems (bun:sqlite unavailable, invalid paths, tool timeouts) tagged [ENV_ISSUE] — note these but exclude from quality score penalty.

Add to your output:
"root_causes": [
  {
    "cause": "Description of the root cause",
    "symptoms": ["FM-x.x", "FM-y.y"],
    "attribution": "agent" | "CROSS_AGENT:<source>" | "ENV_ISSUE"
  }
]

Why: Phase 1 testing showed 56% of flagged issues collapse into fewer root causes, with cross-agent attributions in every session tested. Reporting root causes instead of symptoms produces actionable fixes.
```

## Evidence File
Full Phase 1 results: `.state/backward-trace-results.md`
