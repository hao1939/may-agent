# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777368327578_52
- **Status:** done
- **When:** 2026-04-28T09:48:49.704Z
- **Duration:** 23m22s

## What Happened
The transcript reveals the REAL issue — the gym runner is running the **QA agent's heartbeat** instead of executing the scenario task. The `may-agent --oneshot --agent "coder"` command is being hijacked. This is a systemic gym runner routing issue.

Let me document these findings and checkpoint:
