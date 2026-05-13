# Iteration 1 validation — strategy extractor calibration

## Goal
Improve `agents/evaluator/skills/extract-strategy.cjs` so periodic task #7 can extract reusable positive tactics from fresh, verified-success sessions instead of only surfacing recovery/error-cleanup lessons.

## Code change summary
Updated `agents/evaluator/skills/extract-strategy.cjs` to:
- parse assistant `content[].toolCall` entries in modern session JSONL instead of only legacy `toolCalls`
- preserve assistant planning text and tool-call structure from current transcripts
- accept `--mode strategy` as a CLI alias for `--type strategy`
- add positive-strategy heuristics for:
  - explicit `GOAL` / `PLAN` / `DONE WHEN` framing
  - schema-hint recovery that leads to a successful `query_db` result
  - turning evidence gathering into a concrete action before finish
  - read-before / edit / read-after verification loops

## Fresh verified-success sample
Runtime `evaluations` rows confirm these three latest sessions are heuristic `good` samples:
- `s_1778701694460_271` (`scout`) — quality `0.85`, efficiency `0.8`, verdict `good`
- `s_1778701694150_268` (`may`) — quality `0.85`, efficiency `0.8`, verdict `good`
- `s_1778701694563_272` (`dev`) — quality `0.85`, efficiency `0.8`, verdict `good`

## Post-change extractor results
### `s_1778701694150_268` (`may`)
Extractor now emits positive tactics including:
- `Starts with an explicit GOAL/PLAN/DONE WHEN frame before tool use`
- `Uses DB schema/error hints to recover into a successful follow-up query`
- `Turns evidence gathering into one concrete action before finishing`

### `s_1778701694563_272` (`dev`)
Extractor now emits positive tactics including:
- `Starts with an explicit GOAL/PLAN/DONE WHEN frame before tool use`
- `Uses DB schema/error hints to recover into a successful follow-up query`
- `Turns evidence gathering into one concrete action before finishing`
- `Brackets edit on agents/dev/workspace/investigations/2026-05-13-empty-assistant-error-metric-gap.md with read-before and read-after verification`

### `s_1778701694460_271` (`scout`)
Still returns zero lessons. This transcript is a weak positive sample for calibration because it contains invalid `bash` / `finish` tool-call arguments and no durable evidence-gathering-to-action pattern despite the heuristic `good` row.

## Outcome
The extractor is no longer all-zero on the fresh verified-success sample set: it now surfaces reusable positive tactics on 2 of the 3 newest verified-success sessions, including planning, schema-guided recovery, action-after-evidence, and verification-loop tactics.

## Remaining gap
Current optimization heuristics can still emit waste-focused lessons alongside positive tactics, and the shortest/weakest "good" transcripts may still produce zero output. A next iteration should rank or suppress noisy optimization lessons when stronger positive tactics are present, and add a compact-success heuristic for research/exploration-only sessions.
