# Knowledge Context

## Skills (distilled)
- **File safety**: Read before write. Check size with `wc -l` before full read.
  Never write after truncated read. Verify edits by reading back.
- **Error handling**: No silent failures. Retry with changes, not blindly.
  Escalate structurally: sub-agent → agent → human.

## Available References
Read on demand when relevant:
- `knowledge/coaching.md` — coaching session notes
- `knowledge/JOURNAL.md` — research journal
- `knowledge/SIGNALS.md` — signal tracking
- `knowledge/deep-dives/` — deep dive analyses
- `agents/shared/skills/` — full skill guides
