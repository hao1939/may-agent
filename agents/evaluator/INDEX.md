# Evaluator Knowledge Index

## Skills
- `monitor-session`: **L2 Kinetic Defense** (Wink Pattern). Asynchronous watchdog for running sessions. Detects loops, stalls, and drift. Checks the last 10 lines of session.jsonl.
- `detect-p53-drift`: **L3 Collective Defense** (HAE Framework). Reads `delegation.jsonl` to calculate Integration Success Rate (ISR). Detects drift at the system level.
- `trigger-response`: **Automated Recovery** (Growth Cycle). Triggers a "Growth Cycle" (Coach) or "Revert" (Tech-Lead) when ISR drops below threshold.

## Workflows
- `evaluate-session`: **Post-Hoc Analysis**. Reads completed session logs, scores against rubric, and writes evaluation report.
- `monitor-system`: **Periodic Check**. Runs `monitor-session` on all active sessions every 10 minutes.

## Philosophy
- **P5 Evidence-Based**: Claims must trace to specific log lines. No guessing.
- **P66 Reflective Planning**: Evaluator owns the "Reflection-on-Action" loop (post-hoc).
- **P79 The Ralph Loop**: Evaluator acts as the "External Stop" for long-running agents.
