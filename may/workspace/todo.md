# TODO

- [2026-03-05] Implement human input collection — on every human message, append a timestamped entry to `workspace/human-inputs.md` capturing both the raw message AND the context (what task was active, what just happened, what agent was running, what the outcome was). The context is what makes the input meaningful — "that's wrong" is useless without knowing what was wrong. Periodically (cron, ~12h) review the log to extract patterns: recurring preferences, design direction, unaddressed ideas, corrections. Use findings to update todo, propose improvements, or delegate exploration. Prerequisite: May needs file write access to its own workspace — either add `read-write` tool or add a workspace-scoped write tool.

# Tracking

_(empty)_
