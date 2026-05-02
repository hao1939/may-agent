# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777740150045_701
- **Status:** done
- **When:** 2026-05-02T16:42:51.271Z
- **Duration:** 21s

## What Happened
This is a known issue documented in KE-452 and KE-471. The `project.active-count` metric target of 3 is stale — it was set when projects were actively running, but those projects have since been legitimately closed. The target itself is outdated and needs human decision on whether to create new projects or lower the target.

This has been flagged 10 consecutive times and prior KEs identify it as a target/lifecycle issue, not a system failure. Per guidance: escalate to human.
