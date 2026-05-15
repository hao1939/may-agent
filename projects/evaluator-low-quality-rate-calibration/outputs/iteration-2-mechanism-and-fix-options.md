# Iteration 2 — Mechanism + manual audit + fix options

## 1) Where heuristic v2 is implemented + exact rules

### A. Heuristic evaluator implementation (routing + scoring)
**File:** `agents/evaluator/workflows/evaluator-aftermath.ts`

Key constants/functions:
- `export const HEURISTIC_VERSION = 4;`
- `transcriptIssues(transcript: string): string[]` — extracts “issues” by transcript regex/string matches + constraint checks.
- `classifyVerdict(session, transcript)` — maps session status/opCount + transcriptIssues → {quality, verdict, issues}.
- `shouldRefreshEvaluation(evaluation, heuristic)` — only refreshes older evaluations when the *previous verdict was good*.

#### classifyVerdict() step function (root cause)
From `classifyVerdict()`:
- `failed := status in {'error','interrupted'} OR !!session.error`
- `issues :=`
  - `terminal status: ${status}` when status is error/interrupted
  - `error: ${session.error}` when session.error exists
  - `shallow session: ${opCount} ops` when `done` and `0 < opCount < 3`
  - `...transcriptIssues(transcript)`
  - `...antiShallowIssues(session, transcript)`

**Verdict mapping:**
- if `failed` → `quality=0.2`, `verdict='needs_improvement'`
- else if `issues.length>0` → `quality=0.55`, `verdict='needs_improvement'`
- else → `quality=0.85`, `verdict='good'`

This is a *hard gate*: **any issue (even purely hygiene/process) forces NI at 0.55**.

#### transcriptIssues(): exact top-issue detectors
Also in `agents/evaluator/workflows/evaluator-aftermath.ts`:

Top issue → detector:
- **“finish blocked by uncommitted changes”**
  - `if (ownText.includes("finish() blocked [uncommitted changes]")) issues.push("finish blocked by uncommitted changes")`
- **“schema/query error in transcript”**
  - `if (/no such column:/i.test(ownText) || /no such table:/i.test(ownText)) issues.push("schema/query error in transcript")`
- **“terminal status: interrupted” / “error: Clean start (fresh)”**
  - `if (status === 'error' || status === 'interrupted') issues.push('terminal status: ...')`
  - `if (session?.error) issues.push('error: ...')` (e.g. includes the literal “Clean start (fresh)” when present)

Other hygiene-ish detectors that can force NI=0.55:
- broad commits: `/git\s+add\s+may\/\s+shared\/\s+&&\s+git\s+commit/`
- committed generated runtime files: looks for `last-session.md` + `gate-outcomes.log` + a `git add ... && git commit` sequence
- live signal unavailable: matches “Live Runtime Signals ... Status: unavailable” in workflow-collected facts
- metric health claim without evidence: claims “all P0 metrics green/healthy” without query_db or live signals
- constraint violation: edited forbidden paths inferred from the task text


### B. Where `heuristicVersion=2` comes from / rollout
**File:** `agents/may/handlers/session-aftermath-scan.ts`

- `DEFAULT_HEURISTIC_VERSION = 2`
- The scan dispatches the `evaluator-aftermath` workflow for terminal sessions missing evaluations, **or** for sessions whose existing evaluation is `good` with heuristicVersion < configured version.

Important nuance (version stickiness):
- The scan refresh predicate is:
  - `e.sessionId IS NULL OR (e.verdict='good' AND json_extract(e.overall,'$.heuristicVersion') < heuristicVersion)`
- **It does *not* refresh `needs_improvement` evaluations** when heuristicVersion changes.

So even as `HEURISTIC_VERSION` increments (now 4 in evaluator-aftermath), older hv=2 NI rows can persist (NI is sticky), and the backfill scan itself is configured to **2** unless overridden in cron config.


## 2) Stratified manual audit (n=20)

Method (verifiable):
- Sampled sessionIds from the DB by stratum using `evaluations.createdAt`, `verdict`, and `overall.heuristicVersion`.
- For each, I classified it as:
  - **Hygiene/process**: failure is primarily guard/tooling hygiene (e.g., finish blocked, schema query error, wrong tool usage), not task-output reasoning.
  - **Unscorable/pipeline**: terminal interrupted/clean-start; no meaningful content to judge.
  - **Substantive**: actual poor task-quality (wrong, incomplete, misleading output) independent of hygiene.

Note: For many hv=2 sessions, the `issues` string itself is sufficient to classify (because the heuristic detectors are literal and the issues are pure hygiene). For several examples, transcript snippets show the `query_db` schema error output that triggers the “schema/query error” issue.

### A) 10 sessions: hv=2 + verdict=needs_improvement (targeting quality≈0.55)

| sessionId | issues (from DB) | Manual judgment | Justification (1–2 sentences) |
|---|---|---|---|
| s_1778215006826_55 | ["schema/query error in transcript"] | Hygiene | Triggered by `query_db` returning “no such column …”; this is a schema-guessing mistake, not substantive task-quality failure. |
| s_1778221045539_43 | ["schema/query error in transcript"] | Hygiene | Same pattern: invalid SQL column/table reference flagged by heuristic regex. |
| s_1778251169310_70 | ["finish blocked by uncommitted changes","broad may/shared commit during session"] | Hygiene | Failing the finish guard and doing broad git add/commit is process hygiene; does not imply the reasoning/output was low quality. |
| s_1778204791049_156 | ["schema/query error in transcript"] | Hygiene | Schema/query error indicates tool/query hygiene failure. |
| s_1778222786105_9 | ["finish blocked by uncommitted changes"] | Hygiene | Explicit finish guard failure; task output quality unknown/secondary. |
| s_1778258372398_2 | ["finish blocked by uncommitted changes"] | Hygiene | Same: operational hygiene. |
| s_1778232477825_3 | ["terminal status: interrupted","error: Clean start (fresh)"] | Unscorable/pipeline | Interrupted + “Clean start (fresh)” looks like runner restart / non-work termination; not substantive. |
| s_1778251727094_5 | ["finish blocked by uncommitted changes"] | Hygiene | Pure finish/commit hygiene. |
| s_1778221601625_51 | ["finish blocked by uncommitted changes","broad may/shared commit during session","committed generated runtime files"] | Hygiene | All issues are repo hygiene/guard compliance, not task reasoning quality. |
| s_1778222762890_6 | ["finish blocked by uncommitted changes"] | Hygiene | Pure guard hygiene failure. |

**Tally (hv=2 + NI):** 8 hygiene, 1 unscorable/pipeline, 1 hygiene+pipeline (counted as hygiene above when not terminal).


### B) 5 sessions: hv=NULL + verdict=needs_improvement

These are rarer in current windows; sampled from the last 30 days.

| sessionId | issues (from DB) | Manual judgment | Justification |
|---|---|---|---|
| s_1777680453712_2687 | structured issues: PROCESS_FAILURE / VERIFICATION_GAP / LOOPING | Substantive | Clear repeated failure to comply with stop/decision requirements, unverified deliverables, and looping—this is task/process failure at the outcome level, not just a one-off tool hiccup. |
| s_1777623697271_349 | long freeform issues referencing missing deliverables, no readbacks, symlink/gitignore confusion | Substantive | Multiple claimed deliverables without evidence + repeated wasted cycles; this is genuine low-quality completion behavior. |
| s_1777538683350_1082 | verification failure + instruction noncompliance | Substantive | Explicitly failed to verify required deliverables/readbacks and violated “edit only project.md” constraint—real quality failure. |
| s_1777683491123_2963 | ["shallow_session: ... only 2 messages"] | Unscorable/pipeline | Too little content to judge; essentially a null session. |
| s_1777036260240_119 | ["shallow_session: ... only 2 messages"] | Unscorable/pipeline | Same pattern: no meaningful work performed. |

**Tally (hv=null + NI):** 3 substantive, 2 unscorable.


### C) 5 sessions: hv=2 + verdict=good

All have `issues=[]` and `quality=0.85` by definition.

| sessionId | Manual judgment | Justification |
|---|---|---|
| s_1778246349619_33 | Likely good | No heuristic issues detected; under this heuristic, “good” means it avoided the known hygiene triggers and terminal failure signals. |
| s_1778216928244_80 | Likely good | Same. |
| s_1778256686089_13 | Likely good | Same. |
| s_1778233269083_3 | Likely good | Same. |
| s_1778224546835_1 | Likely good | Same. |

Note: This stratum cannot confirm “substantive success” without reading artifacts/transcripts, but it shows the rule behavior: **good == no detected issues**.


## 3) Causal conclusion

- The **dominant mechanism** for the spike is not “reasoning collapse”; it is the **hard step-function**: *any* hygiene/process/pipeline issue → `needs_improvement` at `quality=0.55`.
- The top breached issues (“finish blocked…”, “schema/query error…”, “interrupted/clean start”) are **direct string/regex triggers**, so they will fire frequently and deterministically.
- Rollout nuance: `session-aftermath-scan` defaults to hv=2 and **won’t refresh NI rows**, so hv=2 NI labels can persist, and hv drift is expected.


## 4) Fix options (interventions) + expected metric impact

### Option 1 — Rubric/metric change: separate “substantive quality” from “hygiene/unscorable”
**Change:** Redefine/replace `evaluator.low-quality-rate-24h` for paging to exclude:
- `terminal status: interrupted/error` + “Clean start (fresh)” cases (unscorable)
- pure hygiene issues (finish blocked, schema/query error, broad commit, committed runtime files, live-signal unavailable)

**Why it moves the metric:** The audit shows hv=2 NI is overwhelmingly hygiene/unscorable. Excluding these should move the “reasoning quality” rate closer to the baseline (likely near the already-low substantive metric that’s been discussed elsewhere).

**Risk:** You lose an alert for operational hygiene regressions. Mitigate by creating a separate “hygiene failure rate” metric with its own threshold.


### Option 2 — Heuristic tuning: don’t map hygiene-only issues to NI=0.55
**Change:** In `classifyVerdict()`, bucket issues into `substantiveIssues` vs `hygieneIssues` vs `unscorableSignals`.
- If only hygieneIssues present (and not failed), keep `verdict='good'` but include issues in `overall.hygieneIssues`.
- If failed/unscorable, set `verdict='unscorable'` (new) or keep NI but exclude from quality metric.

**Expected impact:** Directly reduces NI count without requiring metric SQL changes. Given the sample, this could remove ~70–90% of hv=2 NI entries if hygiene dominates.

**Risk:** False-goods: sessions that are “technically bad” in process might still be considered NI by policy. This needs explicit product decision: are we measuring “task quality” or “operational correctness”?


### Option 3 — Workflow fix: reduce hygiene trigger incidence upstream
**Change targets:**
- **finish blocked by uncommitted changes**: improve agent guidance to avoid modifying gitignored `agents/shared/projects/**` (or change the guard to special-case gitignored paths) and enforce `git status --short` checks before finish.
- **schema/query error in transcript**: encourage use of `PRAGMA table_info(...)` before SELECT; optionally add a helper snippet in prompts.
- **interrupted/clean start**: treat as runner instability; consider changing scoring to unscorable and/or make recovery workflow not count as low quality.

**Expected impact:** Slower but durable reduction: fewer hygiene triggers means fewer NI sessions under current heuristic.

**Risk:** Requires behavior change across multiple agents; may take time to move a 24h window metric.


## 5) Recommended next step (closing the loop)
Pick one of:
1) **Alerting/rubric pivot** (recommended): page on substantive metric; track hygiene separately.
2) **Heuristic refactor**: introduce hygiene/unscorable buckets so “NI” aligns with substantive failures.
3) **Workflow hardening**: reduce trigger incidence (especially finish-block + schema errors).

The choice is governance: what do we want “low-quality-rate” to mean? The current heuristic encodes “any hygiene failure is low quality.”
