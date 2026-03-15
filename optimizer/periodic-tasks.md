# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-15
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-15, session 428): Waste scan of last 20/40 sessions. 3/20 errors (15%) in recent window, 7/40 (17.5%) extended. Dominant error: truncated LLM stream (57% of errors). Scout most error-prone (4/7 errors). All errors are network/proxy-level, not agent behavior. See `workspace/waste-scan-test.md`. **No new optimization code work items** — retry logic for truncated streams would need infrastructure change.

- [x] **Cost outlier scan** — Last done: 2026-05-09
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-05-09): 1656 total evals (1664 files, 8 parse errors), 712 with nonzero cost. Total spend: $895.75, mean $1.26, median $0.30, P90 $3.91, P95 $6.24, max $16.42. **145 outliers >$2 (20.4%)** totaling $669.63 (74.8% of spend). 43 expensive failures ($181.43 wasted). **System still idle since 2026-03-13** — 0 files modified since last scan, no new agent sessions. Per-agent leaders unchanged: `unknown` $199, `coder` $192, `coach` $110, `tech-lead` $110, `optimizer` $78. **Prompt cache**: 12.8% overall — Opus agents all 0%, bob 84.1% (Gemini), qa 62.4% (GPT), amy-kimi 72.2%. 138/145 outliers have 0% prompt cache — LiteLLM proxy blocker confirmed, not code-level. **Failure chain patterns in outliers**: empty-args 77, path hallucination 146 (in chain strings). 1049/1049 tests pass (87 files), tsc clean. **No new optimization code work items** — all patterns pre-existing. System needs active operation to generate new data.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-13
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-13): 26 cron entries, 0 job-history entries (cleared), 1049/1049 tests pass (87 files), tsc clean. Git clean (5 commits ahead). System idle since 2026-03-13, no new sessions. 10 enabled `run-agent-task` entries, 1 disabled (iraq-conflict-monitor). 9/10 require genuine LLM cognitive work: pattern analysis (analyze-failures), optimization (optimize), semantic dedup (lesson-consolidation), task driving (focus-task-driver), memory consolidation (5×consolidate-memory). **1 marginal candidate: `compliance-audit`** — the CJS script (`detect-p53-drift.cjs`) handles all logic (hash comparison, report writing, bulletin posting, drift-response JSON). LLM agent (evaluator) just runs the script. However, evaluator uses `gpt52` model with $0.00 tracked cost — savings would be negligible. Not worth the handler development effort. No new source files contain LLM API calls. 7 handlers present, all wired correctly. **No actionable conversion candidates.**

- [x] **Handler health check** — Last done: 2026-05-09
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-05-09): 7 handler `.ts` files present (coaching-report, daily-brief, evaluate-sessions, focus-task-tracker, run-agent-task, system-status, watchdog). All 17 cron `handler` references resolve to existing `.ts` files — ✅ no broken wiring. 26 total cron entries (24 enabled, 2 disabled: focus-task-tracker, iraq-conflict-monitor — intentional). 6 handler test files (44 tests), all pass. Missing test coverage: `run-agent-task` and `focus-task-tracker` still have no dedicated test files (unchanged). Full suite: 1049/1049 tests pass (87 files), tsc clean. Job history: 0 entries (data cleared). Git clean, 0 uncommitted changes. **No issues found. System healthy.**

## Weekly
- [x] **Improvement proposals review** — Last done: 2026-05-09 (Finding 18, Cycle 12). **2 new commits since last review**: agent-growth refactor committed (3a6d51e — 16 files, +1725/-168), orphaned test cleanup (85de6e7). Git now clean (0 uncommitted changes — resolved 7+ week risk). 1049/1049 tests pass (87 files), tsc clean. New cross-edit guard (P53) prevents cross-agent identity file modification. Finish tool wired but unadopted. System idle — 0 sessions, evals, job history. Compaction 8/12, prompt caching still 0% for Opus (LiteLLM proxy blocker). **No new optimization work items identified.**

- [x] **Refine-Skill loop (EvoSkill)** — Last done: 2026-03-13
  Run the `agents/shared/tasks/refine-skill.md` protocol: scan recent evals for failure patterns,
  attribute to a skill, make one atomic evidence-based improvement to the skill library.
  Latest (2026-03-13): Scanned 500 most recent evals (1668 total, system idle since 2026-03-13). Top failure modes: VERIFICATION_FAILURE (11), SILENT_FAIL (10), TOOL_MISUSE (6), INCOMPLETE_TASK (6), VERIFICATION_GAP (5), DATA_LOSS_RISK (5). Verification cluster (16 total) still #1 but fully covered by AP-1–AP-9 in verification SKILL.md. **New finding: DATA_LOSS cluster** — 12 occurrences across 4 agents (tech-lead, amy-kimi, bob, may) from write-side content truncation (model output cut mid-write) and shrink guard bypass. Evolved `file-safety/SKILL.md` v1.0.0→v1.1.0: added Core Principle #4 (Prefer Surgical Edits), AP-1 (Output-Truncated Write), AP-2 (Shrink Guard Bypass via Shell), 2 new constraints.

---

## How to use this file
1. Read this file during heartbeat step 3
2. Find the most overdue task
3. Do it
4. Update "Last done" date
