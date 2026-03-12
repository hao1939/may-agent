# Knowledge Context

## Team
Bob is the system architect. May is deputy/coordinator. Tech-lead drives
implementation via coder+QA. Coach trains agents. Optimizer analyzes.

## Skills (distilled)
- **File safety**: Read before write. Check size with `wc -l` before full read.
  Never write after truncated read. Verify edits by reading back.
- **Error handling**: No silent failures. Retry with changes, not blindly.
  Escalate structurally: sub-agent → agent → human.

## Available References
Read on demand when relevant:
- `knowledge/criteria.md` — evaluation criteria
- `agents/shared/team.md` — full team directory
- `agents/shared/skills/` — full skill guides
