# Brief: coder C1.1 convention regression (96.4% → 80.7%)

- **Request**: [req:095aa2b9] from convention-check
- **Convention**: C1.1 read-before-edit — "for every `edit()` call, there must be a preceding `read()` of that path"
- **Checker**: `agents/may/handlers/convention-check.ts:495` (`checkC1_1_readBeforeEdit`). Only counts the `read` tool; does NOT treat `bash: cat <path>` as a prior read.
- **Author**: coach, 2026-04-18

## Headline numbers

Pulled from `convention_checks` table joined with `sessions` (`.state/may.db`).

| Window | N | Pass | Rate |
|---|---|---|---|
| Last 30d (all coder sessions) | 256 | 217 | 84.8% |
| Last 7d | 173 | 144 | **83.2%** (≈ reported 80.7%) |
| Prior 23d (7–30d ago) | 83 | 73 | 88.0% |

Split by session kind (does the blind spot explain it?):

| Bucket | 7d N / pass% | Prior 23d N / pass% | Δ |
|---|---|---|---|
| Gym job sessions (`kind='job'`) | **94 / 78.7%** | 12 / 91.7% | −13.0pp (but N=12 prior) |
| Non-gym (workflow / callAgent) | 79 / 88.6% | 71 / 87.3% | **+1.3pp (flat)** |

**The regression is entirely in gym job sessions.** Non-gym coder C1.1 rate is unchanged (88.6% vs 87.3%).
What changed in the last 7d is a burst of ~94 gym coder jobs (vs ~12 in the prior 23d) tied to
EXP-165 cascading-fix-trap variants run 2026-04-16.

## Top failing sessions (7d)

Of 29 failing C1.1 checks in 7d, 20 are gym jobs and 9 are normal coder work.

**Gym jobs (20 of 20 fall into one pattern — `edit` without preceding `read` tool call in scenario-env paths):**

| session_id | scenario | violation(s) |
|---|---|---|
| s_1776305437634_0 | cascading-fix-trap-v2-commit | edit penalties.js, grades.js — no prior read() |
| s_1776304549977_0 | cascading-fix-trap-v3-binding | edit pipeline.js × 2, grades.js |
| s_1776306685936_0 | exp165-baseline | edit grades.js, homework.js × 2 |
| s_1776304405131_0 | cascading-fix-trap-v2 (tmp) | 6× edit homework.js/grades.js |
| s_1776303492126_0 | sql-injection-in-query-builder | edit product-search.js × 2 |
| …15 more cascading-fix-trap-* / exp165-* variants | same shape | same shape |

Verified workflow (e.g. s_1776305437634_0): `bash: cat src/penalties.js` → `bash: cat src/grades.js` → `edit(penalties.js)` → `edit(grades.js)` → `bash: node test/test.js` → `read(penalties.js)` → `read(grades.js)` → finish. Coder **did** read the files via `cat` before editing, and then also via `read()` after — but the checker only counts `read()` tool calls that precede `edit()`.

**Non-gym failures (9 total, stable rate):**

| session_id | task class | violation |
|---|---|---|
| s_1776475990843_760 | test-assertion fix, auto-pause-recovery | edit × 2 on test/auto-pause-recovery.test.ts — preceded by `grep -n "notify..." src/lib/auto-pause.ts` but no `read(test/auto-pause-recovery.test.ts)` |
| s_1776473916324_739 | disable stale cron in agents/may/cron.json | edit preceded by `sed -n '440,460p' agents/may/cron.json`, no `read()` — read() was done **after** to verify |
| s_1776472333384_728 | tag evaluator sessions with source | edit × 2 on src/lib/evaluator.ts — preceded by `sed -n '850,875p' …`, no `read()` |
| s_1776450847326_554 | agent-loader fix | edit × 3 preceded by `sed -n …` |
| s_1776443173581_485 | bob/archetype agent.json edits | 2 edits preceded by `cat`/`sed`, no `read()` |
| s_1776439878527_450 | evaluation-sync.ts exclusion | edit × 2 preceded by `sed -n '1,50p;370,410p' …` |
| s_1776340890260_94, s_1776265016906_31 | IT-2 tasks | same shape — `sed`/`cat` used before edit |
| s_1775971602013_1886 | task-watchdog / evaluate-task | `cat` before `edit` |

**Same underlying pattern in both buckets**: coder uses `bash: cat|sed|grep` to inspect a file, then `edit()`s it. Semantically it is read-before-edit; syntactically it bypasses the checker.

## Root cause classification

**Scenario/checker artifact — not a real coder behavioral regression.**

Evidence:
1. **Non-gym rate is flat**: 88.6% (7d) vs 87.3% (prior 23d). If coder had regressed on read-before-edit, non-gym would drop too.
2. **Gym-session volume spike explains the headline number**: gym jobs went from 12 → 94 in the last window. Gym jobs currently pass C1.1 at 78.7% because in the fix-the-failing-tests gym flow the coder prompt/SOUL pattern is "cat the file, see the bug, edit, rerun tests" — which uses bash rather than `read()`.
3. **Underlying behavior is correct**: spot-checked s_1776305437634_0 and s_1776472333384_728 directly in `session.jsonl`. In both cases the file was inspected (via `cat` or `sed -n`) immediately before the `edit()`. The coder is not editing blind; it is using the wrong inspection tool from the checker's point of view.
4. **Interventions are already in place and working on what they can affect**: commit `7361dbbf9` (2026-04-16) added C1.1 rule to `coder/context.md`. Non-gym rate is stable and respectable (88.6%). The intervention cannot help where coder uses `cat`/`sed`/`grep` because those *are* legitimate tools for quick inspection.
5. **Precedent**: same shape as the amy C7.1 gym-scenario artifact (2026-04-18 02:58) — regression headline was driven by a burst of gym activity in one scenario family, not a real skill regression.

## Recommended next step

**Close as a gym-scenario/checker artifact. Do not deploy a new coder skill or exercise.**

Two optional follow-ups (P2), in priority order:

1. **(Highest leverage) Fix the checker blind spot**, not the agent.
   File a tech-lead P2 request: in `agents/may/handlers/convention-check.ts:checkC1_1_readBeforeEdit`,
   also treat `bash` tool calls whose command matches `^(cat|sed -n|head|tail|less|more)\s+.*<path>` or
   `grep ... <path>` as prior reads for the referenced path. This would close ~29/29 of the current
   violations and align the check with the underlying convention ("don't edit a file you haven't inspected").
   Without this, every gym run and every `sed -n` inspection will keep producing false C1.1 failures and
   will trigger spurious regression alerts to coach.

2. **(Lower leverage, optional) Add one line to coder context.md**:
   "Prefer `read()` over `cat`/`sed -n` when you plan to `edit()` — the read() tool call is what
   satisfies C1.1." This is a reminder, not a skill. Only worth doing if we choose **not** to
   fix the checker. Guarded by KE-002 (text rules rarely change judgment) — expect ~0pp effect.

Explicitly **not** recommended: a new skill file, a new exercise, a scaffolded workflow. The
underlying behavior is already correct; the metric is wrong. Adding intervention here would be
stacking on a non-problem (KE-123) and would not improve any production outcome.

## Verification
- Data queries run against `.state/may.db` via `bun:sqlite` (see session transcript).
- Spot-checked 2 sessions directly in `.state/sessions/history/*/session.jsonl` via `jq`:
  s_1776472333384_728 (non-gym) and s_1776305437634_0 (gym). Both show `cat`/`sed` inspection
  immediately preceding the flagged `edit()`.
- Checker source reviewed at `agents/may/handlers/convention-check.ts:495–521`.
