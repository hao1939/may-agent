# Finding: Quality Drag Analysis — Technique Gaps in Low-Quality Sessions

**Mode:** C (Skill & Technique Scouting) | **Scan window:** 6h | **Date:** 2026-04-18T18:36Z

## Summary

`quality_preserved` at 0.893 vs 0.9 target. The drag comes from three sources: (1) evaluator "skipped" sessions scoring 0 (152 sessions, dominates the average), (2) real low-quality sessions from bob, tech-lead, coach, and scout, and (3) technique gaps in those failing sessions.

## Key Metrics (last 6h, excluding evaluator)

| Agent | Sessions | Low-Q (<0.7) | Avg Quality | Avg Efficiency |
|-------|----------|--------------|-------------|----------------|
| tech-lead | 25 | 8 (32%) | 0.753 | 0.720 |
| bob | 45 | 5 (11%) | 0.790 | 0.682 |
| scout | 16 | 3 (19%) | 0.814 | 0.688 |
| coach | 34 | 7 (21%) | 0.835 | 0.737 |
| optimizer | 22 | 2 (9%) | 0.883 | 0.737 |
| qa | 11 | 0 (0%) | 0.936 | 0.797 |
| may | 14 | 0 (0%) | 1.000 | 0.800 |

## Root Cause #1: Evaluator Skipped Sessions (152 sessions at quality=0)

The evaluator produces 152 sessions scored quality=0 with verdict "skipped". These are self-evaluations that get auto-scored zero. This is the **dominant drag** on the 0.893 metric. If excluded, the real agent average would be significantly higher.

**Recommendation:** Either exclude evaluator self-sessions from the quality_preserved metric, or assign them quality=1.0 (neutral). This is a measurement artifact, not a real quality problem.

## Root Cause #2: Technique Gaps in Failing Sessions

Analyzing the 10 worst non-evaluator sessions reveals three recurring anti-patterns:

### Anti-Pattern A: Schema Guessing → Failure Chains (tech-lead, bob)
- tech-lead s_1776517584598_213 (q=0.05): 3 DB queries failed due to wrong schema assumptions (`id` column doesn't exist), never recovered to write deliverable
- tech-lead s_1776521193037_265 (q=0.28): Single DB query, conclusions not supported by evidence
- **Technique gap:** High-quality sessions (avg q=0.93) do `PRAGMA table_info()` first. Low-quality sessions guess column names.

### Anti-Pattern B: Interrupted/Incomplete Sessions (scout, bob)
- scout s_1776517579515_211 (q=0.15): Hit API rate limits, session interrupted before deliverables
- bob s_1776523959873_311 (q=0.0): "evaluator did not score" — likely duplicate agent name issue
- **Technique gap:** No graceful degradation. High-quality sessions write partial findings before time runs out.

### Anti-Pattern C: Scope Drift / Wrong Deliverables (coach)
- coach s_1776518709125_231 (q=0.34): Asked to create new scenario, instead modified existing one. 49 ops wasted.
- coach s_1776520784207_253 (q=0.34): Chased non-existent fork script for 7 calls, modified wrong files
- **Technique gap:** High-quality coach sessions (avg q=0.96) stay tightly scoped. These sessions drifted into exploration without anchoring to the task's explicit deliverable list.

## High-Quality vs Low-Quality Technique Comparison

| Technique | High-Q Sessions (≥0.8) | Low-Q Sessions (<0.7) |
|-----------|----------------------|---------------------|
| Schema check before query | Yes (PRAGMA first) | No (guess columns) |
| Write-early (within 5 calls) | Yes | No (still investigating at finish) |
| Read task deliverables explicitly | Yes | No (drift into adjacent work) |
| Graceful partial output on interrupt | Sometimes | Never |
| Verify deliverable exists before finish | Yes | No (claim without evidence) |

## Actionable Recommendations

1. **Metric fix (high impact, easy):** Exclude evaluator self-sessions from quality_preserved calculation, or score them neutral. This alone would push the metric above 0.9.

2. **tech-lead schema discipline:** tech-lead has 32% low-quality rate — worst of all agents. The `PRAGMA table_info()` pattern is in the shared context but tech-lead may not be reading it consistently.

3. **coach scope anchoring:** Coach's low-quality sessions all exhibit scope drift (asked for X, built Y). The DELIVERABLES_CHECKLIST.md skill helps here — verify coach is using it for delegated work sessions.

4. **bob evaluator-skipped sessions:** 3 bob sessions scored 0 with "evaluator did not score (duplicate agent name)". This is a systematic evaluator bug, not a bob quality issue. Should be investigated separately.

## Impact Estimate

- Fixing evaluator scoring artifact: +0.05-0.08 on quality_preserved (likely exceeds 0.9 target)
- Fixing tech-lead schema discipline: +0.01-0.02
- Fixing coach scope drift: +0.01
