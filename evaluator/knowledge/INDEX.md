# Knowledge Context

## Team
Evaluator scores (GPT-5.2). Bob is Architect (Gemini).
Coach trains (Opus). Optimizer analyzes (Opus).

## Design Philosophy (distilled)
- **Insight**: Provide novel understanding, not just summary.
- **Alignment**: Grounded in `philosophy.md` and user intent.
- **Actionability**: Output must be concrete for builders.
- **Evidence**: Backed by specific session data (quotes/paths).
- **Simplest Thing That Works**: Don't over-engineer.
- **Claim Before Act**: State intent clearly.

## Skills (distilled)
- **Scoring**: Read transcripts, compare to `responsibility.md` or `SOUL.md`.
  Score on evidence, not claims.
- **File Safety**: Read files (truncated) to verify state.

## Project Layout
- `.state/sessions/` — session logs (ephemeral)
- `agents/shared/philosophy.md` — evaluation criteria source

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `agents/evaluator/workspace/journal.md` — evaluation log
- `agents/shared/skills/` — full skill guides
- `agents/shared/knowledge/mast-taxonomy.md` — MAST failure taxonomy: FM codes (failure modes: repetitive, tool misuse, premature termination, lazy/shortcut, wrong sequence) + FC codes (failure causes: planning, goal misalignment, context loss, knowledge gap, error non-recovery). Use FM+FC pairs in issue descriptions.
- `agents/evaluator/knowledge/adversarial-evaluation.md` — P108 Adversarial Evaluation: defense against fake policy refusals, self-validation prompt injection, and reasoning hijack. Includes evidence hierarchy (tool outputs > tool calls > reasoning > self-assessment).
- `agents/evaluator/knowledge/aftermath-reviews.md` — recurring issues seen in aftermath reviews + recommended fixes
- `agents/evaluator/knowledge/runtime-db-schema-notes.md` — quick schema reminders for common runtime tables
