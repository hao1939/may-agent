# Coaching Findings

Accumulated findings from coaching sessions. Append-only — each entry records what
was discovered about an agent's behavior during a coaching session.

<!-- Entries below this line -->

## 2026-03-04 — master
- Master circumvented exec write guard using `python3 -c open().write()` instead of invoking CLI agents
- After explicit coaching feedback, master correctly adopted exact claude-code invocation pattern
- Gemini-cli invocation pattern was never tested (Exercise 3 stalled on LLM API)
- Verification is master's strongest skill — consistently runs tsc, adds tests, runs regression tests
- Recommendation: Block `python3 -c` and `node -e` file write patterns structurally in exec-master
