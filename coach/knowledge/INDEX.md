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

## MAST Failure Codes
When diagnosing agent failures or tracking patterns, use standardized MAST codes
from `agents/shared/knowledge/mast-taxonomy.md`. These codes make failure analysis
consistent and searchable across agents and sessions.

- **FM codes** (Failure Mode): *what* went wrong — FM-1.x Repetitive, FM-2.x Tool Misuse,
  FM-3.x Premature Termination, FM-4.x Lazy/Shortcut, FM-5.x Wrong Sequence.
- **FC codes** (Failure Cause): *why* it went wrong — FC-1 Planning, FC-2 Goal Misalignment,
  FC-3 Context Loss, FC-4 Knowledge Gap, FC-5 Error Non-Recovery.

Use FM+FC pairs in coaching feedback: `[FM-1.3 / FC-5.1] Looping because agent didn't read error`.
Track FM frequencies per agent to identify training priorities.

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/knowledge/mast-taxonomy.md` — MAST failure taxonomy (FM + FC codes)
- `knowledge/coaching.md` — coaching history
- `agents/shared/skills/` — full skill guides
