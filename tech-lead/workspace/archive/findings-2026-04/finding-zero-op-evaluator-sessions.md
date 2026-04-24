# Finding: Zero-Op Evaluator Sessions — Architectural Waste

**Date**: 2026-04-18
**Lens**: A (System Architecture)
**Severity**: Low (waste, not breakage)

## Summary

79% of evaluator sessions (2,756 of 3,464) have `opCount=0`. These are LLM evaluation sessions spawned by `evaluation-sync.ts` via `evaluateStandaloneSession()`. The evaluator agent receives a pre-built prompt containing the transcript to score, outputs its evaluation as text, and uses zero tools. Each session creates full session infrastructure (session dir, meta.json, DB row) for what is essentially a single LLM call with no tool use.

## Evidence

### What triggers evaluator sessions

`evaluation-sync.ts` has two phases:

1. **Heuristic phase** (lines 1–6 comment: "Pure JS — no LLM calls, no cost"): Runs in-process, writes evaluations directly to `may.db` via `bun:sqlite`. No agent sessions spawned. (`evaluation-sync.ts:185-230`)

2. **LLM sampling phase** (`evaluation-sync.ts:232-270`): Samples ~30% of heuristic-evaluated sessions, calls `evaluateStandaloneSession()` which spawns evaluator agent sessions via `manager.run("evaluator", prompt, { source: "standalone-eval" })` (`evaluator.ts:856`).

### What opCount=0 means

The evaluator agent receives a fully-constructed prompt (`evaluator.ts:845-855`) containing the transcript, failure chains, and scoring instructions. It returns structured text (scores + verdict). It doesn't need to read files or run commands — all context is in the prompt. So `opCount=0` (no tool calls) is **expected behavior**, not a bug.

### Scale of overhead

From DB query: 2,756 zero-op evaluator sessions out of 3,464 total. The remaining 708 sessions with ops > 0 are evaluator heartbeats and other work. Each zero-op session creates:
- A session directory with meta.json
- A `sessions` DB row
- An `evaluations` DB row (marked `skippedByJs=true` when later processed by heuristic sync — `evaluation-sync.ts:201-214`)

### Is this useful work requiring a session?

**Yes and no.** The LLM call itself is useful — it produces quality/efficiency scores that upgrade heuristic evaluations. But the session infrastructure is overhead. The evaluator could instead be invoked as a direct `llm.call()` with the evaluation prompt, writing results to the DB without creating a session record. This would eliminate ~2,700+ session rows and directories.

## Recommended Action

**No immediate fix needed.** The waste is cosmetic (extra DB rows and directories), not costly in compute or money. The LLM calls themselves are the real cost, and those are necessary.

If session table bloat becomes a problem, consider:
1. Adding a `lightweight: true` flag to `manager.run()` that skips session directory creation
2. Or replacing `manager.run("evaluator", ...)` in `evaluateStandaloneSession()` with a direct LLM API call that writes evaluation results to the DB — bypassing the session system entirely

**Do not fix in this session.** This is an observation, not an action item.
