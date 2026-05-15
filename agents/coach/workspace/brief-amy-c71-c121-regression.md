# Brief: amy C7.1 / C12.1 regression (last 7d vs 30d)

Author: coach (session s_1776480916281_800, 2026-04-18)

## Headline numbers (from .state/may.db convention_checks)

| Convention | 7d pass rate | 30d pass rate | 7d fails |
|---|---|---|---|
| C7.1 (root-is-app) | 43/52 = **82.7%** | 55/65 = 84.6% | 9 |
| C12.1 (session-start) | 47/52 = **90.4%** | 60/65 = 92.3% | 5 |

The 7d-vs-30d gap is real but small in absolute terms (9 and 5 fails respectively). The headline "C7.1 92.3% → 82.7%" and "C12.1 100% → 90.4%" in the dispatch match the aggregate numbers closely (minor discrepancy = different rolling windows).

## (a) Failing session IDs + excerpt

All 14 failing checks come from **13 distinct sessions, 12 of which are the same gym scenario**: `# Fix the Product Search Service ...` (scenario `sql-injection-in-query-builder` under `agents/gym/scenarios/`).

```
2026-04-17T22:19Z  C12.1  s_1776293207616_0   task="echo hello"                (first call: bash)
2026-04-17T18:19Z  C7.1   s_1776293769471_0   product-search gym               cd /home/user && node test/product-search.test.js 2>&1
2026-04-16T12:18Z  C12.1  s_1776293842963_0   product-search gym               (first call: bash)
2026-04-16T00:48Z  C7.1   s_1776295143391_0   product-search gym               cd /home/user && node test/product-search.test.js 2>&1
2026-04-16T00:48Z  C7.1   s_1776295262039_0   product-search gym               cd /home/user && node test/product-search.test.js 2>&1
2026-04-16T00:48Z  C7.1   s_1776295330384_0   product-search gym               cd /home/user && node test/product-search.test.js
2026-04-16T00:48Z  C12.1  s_1776295077615_0   product-search gym               (first call: bash)
2026-04-15T23:18Z  C7.1   s_1776293924330_0   product-search gym               cd /home/user && node test/product-search.test.js 2>&1
2026-04-15T23:18Z  C7.1   s_1776293982892_0   product-search gym               cd /home/user && node test/product-search.test.js 2>&1
2026-04-15T23:18Z  C7.1   s_1776294178236_0   product-search gym               cd /home/user && node test/product-search.test.js 2>&1
2026-04-15T23:18Z  C7.1   s_1776294233703_0   product-search gym               cd /home/user && node test/product-search.test.js 2>&1
2026-04-15T23:18Z  C7.1   s_1776294267188_0   product-search gym               cd /home/user && node test/product-search.test.js 2>&1
2026-04-15T23:18Z  C12.1  s_1776293924330_0   product-search gym               (first was read(src/product-search.js))
2026-04-15T23:18Z  C12.1  s_1776295052988_0   product-search gym               (first call: bash)
```

Overlap between the two conventions: exactly **1 session (s_1776293924330_0)** fails both. The rest fail only one.

Verification (one session trace, s_1776293769471_0):
- First assistant action: `bash("cd /home/user && node test/product-search.test.js 2>&1")` → exits 1 ("No such file or directory").
- Agent then retries without the cd prefix, reads files, eventually edits and finishes.
- C7.1 flagged the first bash line because it contains `/home/`. C12.1 passed for this session because a `read()` happened within the first 5 calls.

## (b) Common pattern

**12 of 13 failing sessions are the same gym scenario** (`sql-injection-in-query-builder` and its forks). That scenario's `task.md` says:

> Run `node test/product-search.test.js` to see the failing tests…

…without specifying the cwd. The scenario is executed in a sandbox rooted at something other than `/app`, so amy's first instinct is to `cd /home/user && node …` — exactly the hallucinated-path pattern C7.1 was created for (EXP-132).

For C12.1, gym sandboxes contain **no `heartbeat.md`, no `agents/<amy>/workspace/`, no context files at all** — amy reasonably starts with `bash(node test/…)` or `read(src/product-search.js)`. The checker's `CONTEXT_FILE_PATTERNS` and `WORKSPACE_PATTERN` never match, so C12.1 flags it as "no orientation".

Third, 1 session is `task="echo hello"` — a trivial job where the first call is `bash("echo hello")`; same structural reason for C12.1 to flag it.

## (c) Root-cause hypothesis

This is **not a regression in amy's behavior**. It is a **measurement artifact**: the convention checker is counting gym-sandbox sessions the same way it counts production heartbeats.

1. **C7.1 signal is real but induced** — the gym task text implies a non-/app working directory, so the agent's `cd /home/user` is a reasonable response to an ambiguous prompt. Fixing it in amy's heartbeat won't help; the scenario prompt itself is the stimulus.
2. **C12.1 signal is a false positive in the gym context** — gym sandboxes have no orientation artifacts to read. The checker's orientation heuristics (heartbeat.md, workspace/, orientation tools) assume a production shape.
3. The n=52 in the 7d window is dominated by gym runs (at least 12/52 = 23% are this one scenario batched on 2026-04-15/16). A handful of sessions skew the percentage noticeably.
4. **This matches the parallel scout-C1.7 and tech-lead-C12.1 briefs this week** (coach/workspace/brief-*-regression.md). The common theme across agents is *gym scenarios depress convention pass rates in the 7d window*, not that agents regressed.

Cross-check: gym_runs table returned 0 rows for these session_ids, which means these gym runs were logged as plain `sessions` (kind=job). That's why they're counted against amy's convention score at all.

## (d) Recommended next step

**Do not apply a behavioral intervention on amy.** Text rules have 0% success against judgment failures (KE-002), and there is no judgment failure here — the gym prompt and the checker are both behaving as designed, but in combination they produce noise.

Two options, in order of cost:

1. **(Recommended, cheap) Exclude gym-job sessions from `convention_checks`** — update `agents/may/handlers/convention-check.ts` (or whatever orchestrates it) to skip sessions where `source='gym'` OR where the task text starts with known scenario prompts. Same fix would clean up the scout-C1.7 and tech-lead-C12.1 regressions. Expected effect: 7d C7.1 jumps back to ~95%+ and C12.1 to ~100% for amy.
2. **(Follow-up) Tighten C7.1 in scenario task.md**: add an explicit "Work from `/app`" line to `agents/gym/scenarios/sql-injection-in-query-builder*/task.md`. This reduces the coder's temptation to guess `/home/user` and makes the scenario a truer test of judgment.

Before shipping either: confirm the gym scenario really is the source by grouping the 14 failures by `sessions.task` (done above — 12/13 are this one task.md). If optimizer or bob wants to own this, the diagnostic script is in this session's tool history.

### One-line ask to dispatch
> "Filter convention_checks to exclude `sessions.kind='job'` where the task matches a gym scenario task.md (or add a `gym` source tag in session creation). Re-run the weekly aggregation. Expected: amy, scout, tech-lead, coach 7d convention rates all move back toward 30d baseline."
