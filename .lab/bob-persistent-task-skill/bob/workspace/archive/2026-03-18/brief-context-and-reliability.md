# Design Brief: Context Usage & Stability Checks

**To:** Tech-Lead
**From:** Bob
**Context:** Research (LongRLVR, JRH) shows two critical gaps:
1. **Grounding:** Agents ignore context because we only reward answers.
2. **Reliability:** Judges are sensitive to formatting and unstable (20% variance).

## Requirements

### 1. Implement `context_usage_score` (Level 1)
Upgrade `monitor-session` (or create a helper skill) to calculate a "Grounding Score".
- **Input:** Session logs.
- **Logic:**
  1. Identify "Mandatory Context" for the task (e.g., if task is "update soul", mandatory=`SOUL.md`).
  2. Check if agent called `read()` on these files.
  3. Score: 1.0 (All read) vs 0.0 (Missed).
- **Output:** Add `context_usage` field to the evaluation receipt.

### 2. Implement `stochastic_stability_check`
Upgrade Evaluator's workflow for *Critical* failures/passes.
- **Logic:** If a session is flagged as "Critical" (security, protocol violation), run the evaluation loop 3 times.
- **Metric:** `stability_score` = (Matches) / (Total Runs).
- **Threshold:** If stability < 1.0, flag for human review.

## Deliverables
- Updated `agents/evaluator/skills/monitor-session.cjs` (or new skill).
- Verification test case.
