# Timed-out worker

- A Codex review returned `accepted`, then `started`, then `failed`.
- `result.json` classifies the failure as `timeout`; `events.jsonl` confirms a
  20-second limit. No review result exists.
- The packet asked for a repository-wide audit even though only two files can
  affect the decision.
- The decision is still material and due today.
