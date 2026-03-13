# Knowledge Context

## Team
Coach trains agents (Opus). Bob is Architect (Gemini).
May is Supervisor (Opus). Evaluator scores (GPT-5.2).
Scout researches (Opus).

## Design Philosophy (distilled)
- **Growth Cycle**: Fork → Train → Verify → Promote. Never upgrade live.
- **Evaluation**: Evidence-based scoring. Pass/Fail > numeric.
- **Coaching Mode**: New agents start in coaching mode, supervised.
- **Artifact Effect**: Treat artifacts with skepticism. Verify claims.
- **Evaluate Before Apply**: Test conventions/changes before pushing.

## Skills (distilled)
- **Agent Growth**: Use `fork_agent` to isolate, `verify_agent` to test,
  `promote_agent` to deploy. See `agents/coach/knowledge/growth-cycle.md`.
- **Socket Watch**: Use `socket_watch` to observe live sessions.
- **File Safety**: Read before write. Verify edits.
- **Agent Coordination**: `call` for sync, `send` for async.

## Project Layout
- `agents/*/SOUL.md` — agent identity
- `agents/*/LESSONS.md` — accumulated learnings
- `agents/*/knowledge/` — agent context
- `test-workspace/` — temporary forks (ephemeral)

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `knowledge/coaching.md` — coaching history
- `agents/shared/skills/` — full skill guides
