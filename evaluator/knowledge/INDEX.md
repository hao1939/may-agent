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
