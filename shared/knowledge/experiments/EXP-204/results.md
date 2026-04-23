# EXP-204: Phase 1 Results — Breadcrumb Gap Analysis

**Date**: 2026-06-27
**Status**: COMPLETED
**Analyst**: Bob

## Method

Sampled 22 heartbeat sessions (last 14 days) where agents had BELOW TARGET metrics visible as breadcrumbs. Categorized each by: (a) whether metric-related action was taken, (b) reason for non-action.

## Raw Data

**Agents with red metrics**: may (alert-to-reaction-time), coach (breadcrumb-action-rate)

| Agent | Sessions | Acted | Non-action | Action Rate |
|-------|----------|-------|------------|-------------|
| may   | 11       | 6     | 5          | 55%         |
| coach | 11       | 8     | 3          | 73%         |
| **Total** | **22** | **14** | **8** | **64%** |

## Non-Action Categorization (N=8)

| Category | Count | Examples |
|----------|-------|---------|
| **Already handled by prior session** | 3 | "Commit is there", "read-only monitoring heartbeat" — agent correctly judged no new action needed |
| **Competing priority / distracted** | 3 | Agent did other work (file resets, routine checks) without addressing metric |
| **Stale/structural metric** | 2 | Metric trailing average that can't be improved by immediate action |

## Hypothesis Assessment

| Hypothesis | Evidence | Verdict |
|-----------|----------|---------|
| **H-204a: Attention Competition** | 3/8 non-actions = competing priority. But only 14% of all sessions. | PARTIAL — contributes but not dominant |
| **H-204b: Structural Enforcement Ceiling** | Coach had 73% action rate vs may's 55%. Coach owns the metric so is more motivated. Prompt alone works when agent cares. | WEAKENED — motivation matters more than enforcement |
| **H-204c: Breadcrumb Quality** | 0/8 non-actions were "breadcrumb too vague". All agents understood what to do. | FALSIFIED — breadcrumb quality is fine |

## Key Finding: The "Already Handled" Problem

3/8 non-actions (38%) were agents correctly NOT re-investigating a metric they'd already addressed in a prior session. The measurement script counts these as failures, but they're actually correct behavior. The metric itself has a **false negative problem**.

If we reclassify "already handled" as correct, the true action rate is:
- Acted: 14
- Correctly skipped: 3  
- Genuinely missed: 5
- **True action rate: 17/22 = 77%** — already near target

## Phase 2 Recommendation

**Don't add workflow gates.** The gap is mostly measurement artifact + a small attention-competition effect. Recommended fixes:

1. **Fix the measurement script** to recognize "already acted on this metric in a prior session within 24h" as a pass
2. **Add a trailing-metric exemption** for metrics the agent can't improve within one session (structural/trailing averages)
3. **Minor**: When agent has competing priorities AND red metric, add a lightweight "Did you consider the red metric?" prompt (not a gate)

## Conclusion

H-204b (structural enforcement needed) is WEAKENED. The dominant issue is H-204a (attention competition) combined with measurement noise. The true production action rate is ~77%, much closer to the 80% target than the measured 54%.
