# TODO

- [2026-03-05] LLM-to-JS audit: Continue reviewing session transcripts and agent tool usage for more patterns where LLM calls can be replaced with JS code. Next candidates to investigate: template-based status reports, simple file existence/routing checks, formulaic cron task dispatch.

# Tracking

- [2026-03-05] LLM-to-JS replacement opportunities — ongoing watch. Review each optimizer run for cases where agents make LLM calls that follow a predictable pattern (same input shape → same output shape, no reasoning required). Goal: reduce cost and latency by replacing these with JS code in the runner/tools.
- [2026-03-05] ✅ LLM-to-JS #1: Aborted/meta-agent session evaluations. Implemented `writeSkippedEvaluations()` in src/evaluator.ts — writes deterministic 0/0 evaluations for sessions with no transcript and meta-agent sessions (evaluator/optimizer/may). Saves ~$0.05-0.15 per evaluator call × 239 aborted sessions = ~$12-36 saved. Committed as 1eccb41.
- [2026-03-22] ✅ Shrink guard for write tool (blind-overwrite fix). Added disk-based file size check to `createWriteTool()` in src/tools.ts. When write() targets an existing file and new content is <50% of existing size, the write is BLOCKED (agent must set `allowShrink=true` to proceed). 50-80% range produces a warning. Files under 500 bytes are exempt (configurable via `shrinkGuardMinSize`). This is independent of the truncation tracker — catches blind overwrites even when tracker isn't active. Addresses s_1772672288075_15 regression (coder overwrote domain.md with 8KB when original was ~38KB). 9 new tests added, all 912 tests pass.
