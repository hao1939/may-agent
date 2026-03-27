# System State & Metrics

## Cost
- **93% cost reduction achieved**: $1.91 → $0.097/session average.
- Total spend: $895.75 across 712 sessions. Mean $1.26, median $0.30, P90 $3.91, P95 $6.24.
- Top spenders: unknown $199, coder $192, coach $110, tech-lead $110, optimizer $78.
- 145 outliers >$2 = $669.63 (74.8% of spend). 138/145 have 0% prompt cache.
- 43 expensive failures = $181.43.

## Prompt Caching
- **0% for all Opus agents** — LiteLLM proxy strips `cache_control` headers.
- Code is implemented (`src/lib/manager.ts` — `cache_control: ephemeral`, system prompt reordering).
- Non-Anthropic agents cache well: bob 84.1% (Gemini), qa 62.4% (GPT), amy-kimi 72.2%.
- Absolute savings now ~$0.04/session — low priority, external dependency.

## Compaction
- 8/12 agents covered: amy, amy-kimi, bob, coach, may, optimizer, scout, tech-lead.
- Remaining 4 don't need it (GPT/Gemini/Kimi models or bounded sessions).
- 0 overflows since enablement.

## Pre-Check System
- Added to `run-agent-task` handler with two modes:
  1. **Active-section scan** — skips LLM if all `### ` tasks contain completed pattern.
  2. **minContentLines** — skips LLM if file has fewer than N non-header/non-empty lines.
- Wired to: focus-task-driver (active-section), consolidate-memory-* (minContentLines=3).
- Pre-check skip rates: 8-25% during active operation, higher when idle.

## LLM-to-JS Conversions
- **All high-impact conversions complete.** No remaining candidates.
- All 11 `run-agent-task` entries involve genuine cognitive work (semantic dedup, pattern analysis, result interpretation).
- Repeatedly confirmed across 5+ scans (2026-03-12 through 2026-05-09).

## Test Suite
- Grew from 998 → 1068 tests (87-88 files) over Mar-May 2026.
- tsc always clean. All tests passing.

## Session Read Guard
- Extended `session-read-guard.ts` to intercept bash tool calls (2026-03-24).
- Blocks `cat/less/more` of session.jsonl and unbounded `grep/rg` of session.jsonl.
- Allows bounded grep (with `| head`, `-c`, `-l`, `-m` flags).
- 29 tests (was 8). Projected savings: ~$10/day from coach sessions.

## Skill Lifecycle Workflow
- Added "ALREADY COVERED" early-exit to Phase 1 discovery (2026-03-24).
- Saves ~90 ops when discovery finds pattern already deployed as skill.
- Needs binary rebuild to activate (code in `agents/shared/workflows/skill-lifecycle.ts`).

## Open Low-Priority Items
- **F13**: Eval verdict format mismatch — 117/1625 evals (7.2%) invisible to coaching-report.ts/daily-brief.ts because workflow-format evals use `.overall.verdict` not `.verdict`.
- **Uncommitted agent-growth refactor**: 7 files, +531/-160 lines, 7+ weeks uncommitted. Includes finish tool with lesson capture.
- **Evaluator P98 write-block**: Cannot deploy skills to evaluator's INDEX.md — requires May or evaluator to do it.
