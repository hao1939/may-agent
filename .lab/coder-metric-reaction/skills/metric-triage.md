# Skill: Metric Triage

**When**: You see metrics in your heartbeat context (injected metrics, dashboard numbers, status indicators).

**Do**: Before starting routine tasks, scan metrics for RED signals — any metric far from its target (e.g., value >> target, or value << target). A red metric is more urgent than any low-priority dispatch item.

**Action**: If you spot a red metric, act on it FIRST:
1. Investigate: query the relevant data (e.g., `bash` to check stuck requests, read logs, etc.)
2. Take action: fix it, escalate it, or fork a task to address it
3. Mention it in your `finish()` summary

**Why**: Metrics reflect real system health. A metric at 76 when target is 0 means something is broken NOW. Routine dispatch items can wait; broken metrics cannot.
