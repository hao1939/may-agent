# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777532973073_657
- **Status:** done
- **When:** 2026-04-30T07:12:30.033Z
- **Duration:** 2m56s

## What Happened
The project handler runs every 30 min AND on events. With coach-quality active at 392 iterations/24h, it's likely the events are cascading — each completion triggers more events. The evaluator runs after each, creating more shallow sessions.

This is a real efficiency problem. I should fork an investigation to tech-lead to look at the project handler's iteration throttling.
