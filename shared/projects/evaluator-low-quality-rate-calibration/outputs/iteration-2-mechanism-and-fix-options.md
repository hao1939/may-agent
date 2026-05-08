# Iteration 2 — mechanism + fix options (heuristic v2)

## 1) Mechanism: where heuristic v2 is implemented + what rules fire

### A. Two places set/drive heuristicVersion (this is the “version drift” mechanism)

1) **Primary evaluator workflow** (currently writing hv=3)
- File: `agents/evaluator/workflows/evaluator-aftermath.ts`
- Constant: `export const HEURISTIC_VERSION = 3;`
- This workflow emits heuristic-based evaluations and stores `overall.heuristicVersion = 3`.

2) **Fallback cron backfill** (defaults hv=2)
- File: `agents/may/handlers/session-aftermath-scan.ts`
- Default: `const DEFAULT_HEURISTIC_VERSION = 2;`
- It dispatches the `evaluator-aftermath` workflow, but its **refresh logic** only forces re-eval of prior **good** evals with `heuristicVersion < DEFAULT_HEURISTIC_VERSION`:
  ```ts
  AND (
    e.sessionId IS NULL
    OR (
      e.verdict = 'good'
      AND COALESCE(CAST(json_extract(e.overall, '$.heuristicVersion') AS INTEGER), 0) < ?
    )
  )
  ```
  Net effect: hv=2 can persist in DB for many sessions, and hv=2 vs hv=3 mixes over time depending on path (normal completion vs backfill).

### B. The “top issues” are emitted by explicit transcript/status detectors

All of the dominant needs_improvement “hygiene” issues come from `transcriptIssues()` and `classifyVerdict()` in:
- File: `agents/evaluator/workflows/evaluator-aftermath.ts`

Key rule mapping (directly matching the issue strings observed in DB):

1) **“finish blocked by uncommitted changes”**
- Rule:
  ```ts
  if (ownText.includes("finish() blocked [uncommitted changes]")) {
    issues.push("finish blocked by uncommitted changes");
  }
  ```
- Interpretation: if the session ever triggers the finish-guard failure, heuristic marks NI.

2) **“schema/query error in transcript”**
- Rule:
  ```ts
  if (/no such column:/i.test(ownText) || /no such table:/i.test(ownText)) {
    issues.push("schema/query error in transcript");
  }
  ```
- Interpretation: any SQLite “no such column/table” error in tool output makes the session NI (even if recovered).

3) **“interrupted / clean start (fresh)”**
- Rules:
  - In `classifyVerdict()`:
    ```ts
    if (status === "error" || status === "interrupted") issues.push(`terminal status: ${status}`);
    if (session?.error) issues.push(`error: ${String(session.error).slice(0, 240)}`);
    const failed = status === "error" || status === "interrupted" || !!session?.error;
    quality: failed ? 0.2 : issues.length ? 0.55 : 0.85
    ```
  - This creates issues like:
    - `terminal status: interrupted`
    - `error: Clean start (fresh)`

### C. Why these rules create a large 0.55 “NI hygiene bucket”

`classifyVerdict()` is a step function:
- terminal failure (`error`/`interrupted`) → **quality 0.2**, verdict NI
- else if **any issue exists** → **quality 0.55**, verdict NI
- else → **quality 0.85**, verdict good

So *any* of the transcript hygiene flags is sufficient to push a session to **needs_improvement** at **quality=0.55**.

## 2) Stratified manual audit (~20 sessions)

Method: pick a stratified set from the last 24h and inspect representative transcript snippets via `.state/sessions/history/<sessionId>/session.jsonl` (using `jq`/`grep`) plus evaluation issues.

### A) 10 sessions: hv=2 + verdict=needs_improvement (focus on quality=0.55)

1) `s_1778262140393_13` (may) — q=0.55 — issues: finish blocked; broad may/shared commit; committed generated runtime files
- Assessment: **Mostly hygiene/process**, not a reasoning collapse. Trigger is explicit finish-guard + committing generated/runtime files.

2) `s_1778261147546_2` (scout) — q=0.55 — issues: schema/query error
- Evidence: query_db error `no such column: id` and attempted `SELECT id ... FROM sessions ...` (wrong schema).
- Assessment: **Hygiene/tooling error** (schema mistake). They still produced an artifact and committed, but heuristic penalizes any schema error.

3) `s_1778261139993_1` (arc) — q=0.55 — issues: finish blocked by uncommitted changes
- Assessment: **Hygiene** (finish guard). Likely delivery exists but wasn’t committed/clean.

4) `s_1778260767916_5` (may) — q=0.55 — issues: finish blocked; broad may/shared commit
- Evidence: finish toolResult shows uncommitted changes in `shared/projects/...` and `shared/gate-outcomes.log`.
- Assessment: **Hygiene**, and also a potentially-correct penalty (uncommitted changes block finish).

5) `s_1778260774855_7` (scout) — q=0.55 — issues: finish blocked by uncommitted changes
- Assessment: **Hygiene** (finish guard) rather than task failure.

6) `s_1778260767387_4` (may) — q=0.55 — issues: schema/query error
- Assessment: **Hygiene** (bad query) unless it prevented completion.

7) `s_1778261673918_5` (scout) — q=0.55 — issues: schema/query error
- Assessment: **Hygiene**.

8) `s_1778260995450_10` (scout) — q=0.55 — issues: finish blocked by uncommitted changes
- Assessment: **Hygiene**.

9) `s_1778261255980_7` (may) — q=0.2 — issues: terminal interrupted; error Clean start (fresh)
- Assessment: **Real failure** (session interrupted). Not a false positive.

10) `s_1778261317514_9` (dev) — q=0.2 — issues: terminal interrupted; error Clean start (fresh); schema/query error
- Assessment: **Real failure** (interrupted). Schema error may be incidental.

Summary for hv2+NI sample: **8/10 are primarily hygiene/process**, **2/10 are genuine terminal failures**.

### B) 5 sessions: hv=NULL + verdict=needs_improvement

1) `s_1778211956403_3` (dev) — q=0.55 — issues: schema/query error; committed generated runtime files
- Assessment: **Hygiene**.

2) `s_1778211943135_2` (may) — q=0.55 — issues: schema/query error
- Assessment: **Hygiene**.

3) `s_1778211315535_5` (may) — q=0.2 — issues: interrupted; Clean start (fresh); schema/query error
- Assessment: **Real failure** (interrupted).

4) `s_1778211629857_6` (dev) — q=0.55 — issues: finish blocked; schema/query error; broad commit; committed runtime; live signals unavailable
- Assessment: **Mostly hygiene** (multiple process flags).

5) `s_1778211532870_3` (may) — q=0.55 — issues: schema/query error
- Assessment: **Hygiene**.

Summary hv=NULL+NI: **4/5 hygiene**, **1/5 terminal failure**.

### C) 5 sessions: hv=2 + verdict=good

1) `s_1778260767342_3` (scout) — good, q=0.85 — issues: none
- Assessment: **Good**.

2) `s_1778259480085_9` (may) — good, q=0.85 — issues: none
- Assessment: **Good**.

3) `s_1778258867886_8` (arc) — good, q=0.85 — issues: none
- Assessment: **Good**.

4) `s_1778258366478_1` (may) — good, q=0.85 — issues: none
- Assessment: **Good**.

5) `s_1778258262135_22` (may) — good, q=0.85 — issues: none
- Assessment: **Good**.

## 3) What this implies about causality (not just correlation)

- The high NI-rate is driven by a **step-function rubric**: *any* detected “issue” → NI @ 0.55.
- The most common “issues” are **guard/process hygiene** signals, not content-quality failures.
- The “schema/query error” detector is particularly brittle: it treats **any** `no such column/table` as NI even if the agent immediately corrects the query using the returned schema.

Supporting counts (last 24h):
- Total evals: **450**; needs_improvement: **238** → NI-rate **0.529** (note: this is eval-count NI-rate; metric may have additional filters)
- Among NI, sessions containing these issue strings (not union-count, but occurrence):
  - `finish blocked by uncommitted changes`: **139**
  - `schema/query error in transcript`: **103**
  - `error: Clean start (fresh)`: **24**
  - `terminal status: interrupted`: **27**

## 4) Fix options (with expected metric impact)

### Option A — Rubric change: split “hygiene” from “quality” (recommended if intent is to measure reasoning quality)

**Change:** redefine `evaluator.low-quality-rate-24h` to exclude (or separately bucket) sessions whose only issues are process/guard hygiene:
- finish blocked by uncommitted changes
- broad may/shared commit during session
- committed generated runtime files
- schema/query error in transcript
- workflow live signal injection unavailable

**Expected impact:** Large immediate drop in low-quality-rate, because the manual audit indicates the majority of NI are hygiene-only.
- In the hv2 NI sample: 8/10 would move out of “low-quality” if hygiene-only excluded.

**Tradeoff:** You lose visibility into hygiene regressions unless you add a dedicated metric.

**Companion metric (to keep pressure):** create a new metric like `evaluator.hygiene-failure-rate-24h` counting those issue strings.

### Option B — Heuristic tuning: require “impact” or repetition before NI (keep hygiene signal, reduce false positives)

**Change:** keep detecting hygiene issues, but avoid turning single recoverable events into NI.

Concrete tuning ideas:
1) **Schema/query error softening**
- Only flag `schema/query error in transcript` if either:
  - the error repeats (>=2 occurrences), or
  - the session ends with an error/interrupted, or
  - the session has *no* subsequent successful `query_db` call.

2) **Finish-block softening**
- Only NI if finish remains blocked at end-of-session OR if no subsequent successful finish.
  - (Currently any occurrence is enough, even if corrected later.)

**Expected impact:** Moderate-to-large reduction in NI, depending on how often these are “recovered” within the same session.

**Tradeoff:** Slightly more complex heuristic, but still purely local and explainable.

### Option C — Workflow fix: reduce incidence of the hygiene triggers upstream

1) **Uncommitted-changes finish blocks**
- Root: agents attempt to modify ignored paths under `agents/shared/projects/**` or generated logs like `shared/gate-outcomes.log`.
- Fix direction:
  - ensure project artifacts live in a committable area (or change ignore rules if appropriate)
  - update guard messaging to recommend writing to `agents/<agent>/workspace/` when shared/projects is ignored
  - add a workflow step that checks `git status` before calling finish and either commits or stashes.

2) **Schema/query errors**
- Root: agents guessing DB schemas (`id`, `created_at`) instead of using `PRAGMA table_info`.
- Fix direction:
  - add a “DB schema first” nudge to system instructions for evaluator-like tasks
  - add a helper snippet in evaluator docs showing canonical schema queries

**Expected impact:** Slower but durable reduction in NI/hygiene; improves actual operational quality.

## 5) Answers to the iteration questions

1) **Is the goal closer?** Not yet; this iteration focuses on mechanism/causality and concrete interventions.
2) **What did we learn?** Causality is a step-function heuristic: any one hygiene detector → NI@0.55; fallback scan defaults hv=2 causing version drift.
3) **Is the current milestone the right next step?** Yes—next step should pick Option A/B/C (or a mix) and implement with a test/gym scenario.
4) **Are we closing the loop?** Closer: we now have exact rule locations + a manual audit showing most NI is hygiene.
5) **Is it verified?** Partially: rule locations are directly cited from code; manual audit includes transcript evidence for at least one representative schema error session.
6) **What’s blocking progress?** No external blockers; the remaining work is a decision: adjust metric/rubric vs tune heuristic vs fix workflows.
