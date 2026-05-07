# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1778159642609_0
- **Status:** success
- **When:** 2026-05-07T13:29:00.379Z

## What Happened
Diagnosed why May's heartbeat shows "2 hours ago" on dashboard: the shouldSkipHeartbeat() guard in heartbeat-data.ts idle-skips the LLM session when there are no red metrics, alerts, inbox events, or active projects. The handler fires every 30min but returns in ~82ms without spawning a real session. This is intentional cost-saving behavior.
