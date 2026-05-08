# Iteration 2 — Mechanism + fix options (manual audit)

## 1) Where heuristic v2/v3 is implemented + rule mapping

### Primary implementation
**File:** `agents/evaluator/workflows/evaluator-aftermath.ts`

Key entry points:
- `export const HEURISTIC_VERSION = 3;` (line near top of file)
- `classifyVerdict(session, transcript)` — produces `quality`, `efficiency`, `verdict`, and `issues`.
- `transcriptIssues(transcript)` — extracts hygiene/process issues from transcript text.

### Rollout / application point
**File:** `agents/may/handlers/session-aftermath-scan.ts`
- `DEFAULT_HEURISTIC_VERSION = 2` and `heuristicVersion = config.heuristicVersion ?? DEFAULT_HEURISTIC_VERSION`.
- Cron queries for candidates that either:
  - have **no evaluation**, OR
  - have a **good** evaluation with `overall.heuristicVersion < heuristicVersion`.

**Important mechanical note (persistence):** the scan refreshes *stale good* heuristic evaluations, but it **does not refresh needs_improvement** evaluations when heuristicVersion increments (because the SQL only refreshes `e.verdict='good'`). This makes NI “sticky” across heuristic version changes.

### Rule mapping to top issue strings

#### A) “finish blocked by uncommitted changes”
**Rule location:** `transcriptIssues()`
```ts
if (ownText.includes("finish() blocked [uncommitted changes]")) {
  issues.push("finish blocked by uncommitted changes");
}
```
**Mechanism:** any occurrence of that literal substring in the *assistant-owned transcript view* triggers the issue.

#### B) “schema/query error in transcript”
**Rule location:** `transcriptIssues()`
```ts
if (/no such column:/i.test(ownText) || /no such table:/i.test(ownText)) {
  issues.push("schema/query error in transcript");
}
```
**Mechanism:** regex match against transcript text for SQLite-like errors.

#### C) “terminal status: interrupted” and “Clean start (fresh)”
**Rule location:** `classifyVerdict()`
```ts
if (status === "error" || status === "interrupted") issues.push(`terminal status: ${status}`);
if (session?.error) issues.push(`error: ${String(session.error).slice(0, 240)}`);
...
const failed = status === "error" || status === "interrupted" || !!session?.error;
return {
  quality: failed ? 0.2 : issues.length ? 0.55 : 0.85,
  verdict: failed || issues.length ? "needs_improvement" : "good",
  issues,
};
```
**Mechanism:** if the session ends with `status in {error, interrupted}` OR `session.error` is non-null (e.g. `Clean start (fresh)`), it is treated as **failed** and forced to `quality=0.2` + `needs_improvement`.

#### D) “shallow session:*” drivers
**Rule location:** `classifyVerdict()`
```ts
if (opCount > 0 && opCount < 3 && status === "done") issues.push(`shallow session: ${opCount} ops`);
```
**Mechanism:** sessions that complete with very low opCount get a hygiene-ish issue and therefore `needs_improvement` (via the step-function).

### The step-function that converts *any issue* into NI (root cause for 0.55 cluster)
**Rule location:** `classifyVerdict()`
- If `failed`: quality=0.2, verdict=NI.
- Else if `issues.length>0`: **quality=0.55**, verdict=NI.
- Else: quality=0.85, verdict=good.

This explains the observed clustering at `quality=0.55`: it’s the single “has any issues” bucket.

## 2) Stratified manual audit (~20 sessions)

### Method
This audit is limited to what we can see from the DB (session status/error + evaluation issues). It is therefore a **proxy** for true task quality; the primary purpose is to classify whether the *trigger* is “substantive task-quality failure” vs “process/guard/pipeline hygiene”.

If needed for higher confidence, the next step would be to sample session transcripts from `.state/sessions/.../session.jsonl` via workflow-collected tools; this iteration stays guard-safe and DB-driven.

### A) 10 sessions: hv=3 (v2+) AND verdict=needs_improvement (mostly quality=0.55)

1. `s_1778280064363_218` (scout) — issues: schema/query error in transcript
   - **Classification:** hygiene/pipeline. Trigger is a query/schema mismatch in transcript, not necessarily bad reasoning.
2. `s_1778278315009_201` (scout) — issues: review override: needs_improvement
   - **Classification:** substantive/unknown (human override). Not hygiene-triggered.
3. `s_1778278264170_200` (scout) — issues: schema/query error in transcript
   - **Classification:** hygiene/pipeline.
4. `s_1778277731703_197` (may) — issues: finish blocked by uncommitted changes; broad may/shared commit; committed generated runtime files
   - **Classification:** hygiene/process (guard compliance + repo hygiene).
5. `s_1778277106112_188` (may) — same issues as above
   - **Classification:** hygiene/process.
6. `s_1778276654257_178` (dev) — issues: finish blocked by uncommitted changes
   - **Classification:** hygiene/process.
7. `s_1778276522479_174` (scout) — issues: finish blocked by uncommitted changes
   - **Classification:** hygiene/process.
8. `s_1778276464007_171` (scout) — issues: finish blocked by uncommitted changes; schema/query error
   - **Classification:** hygiene/process.
9. `s_1778276430940_168` (may) — issues: finish blocked by uncommitted changes; broad may/shared commit
   - **Classification:** hygiene/process.
10. `s_1778275931372_166` (may) — issues: finish blocked by uncommitted changes; broad may/shared commit
   - **Classification:** hygiene/process.

**Tally (10):** hygiene/process/pipeline = 9, substantive/unknown (override) = 1.

### B) 5 sessions: hv=NULL AND verdict=needs_improvement

(From last ~72h; these are older pre-rollout or missing hv serialization.)

1. `s_1778211956403_3` (dev) — issues: schema/query error; committed generated runtime files
   - **Classification:** hygiene/process.
2. `s_1778211943135_2` (may) — issues: schema/query error
   - **Classification:** hygiene/pipeline.
3. `s_1778211629857_6` (dev) — issues: finish blocked; schema/query error; broad may/shared commit; committed runtime; workflow live signal injection unavailable
   - **Classification:** hygiene/process/pipeline.
4. `s_1778211532870_3` (may) — issues: schema/query error
   - **Classification:** hygiene/pipeline.
5. `s_1778211482795_0` (may) — issues: schema/query error
   - **Classification:** hygiene/pipeline.

**Tally (5):** hygiene/process/pipeline = 5.

### C) 5 sessions: hv=3 AND verdict=good

1. `s_1778279531730_213` (may) — issues: []
   - **Classification:** good (no hygiene flags present).
2. `s_1778278931312_211` (may) — issues: []
   - **Classification:** good.
3. `s_1778278454246_204` (dev) — issues: []
   - **Classification:** good.
4. `s_1778278330366_203` (may) — issues: []
   - **Classification:** good.
5. `s_1778277731735_198` (may) — issues: []
   - **Classification:** good.

### Audit conclusion
Within this stratified sample, **needs_improvement is overwhelmingly triggered by hygiene/process/pipeline flags**, not by evidence of substantive task failure.

Caveat: This doesn’t prove the underlying work was good—only that the *heuristic mechanism* is dominated by a small set of hygiene/pipeline triggers plus a step-function that forces NI.

## 3) Fix options (rubric vs heuristic vs workflow), with expected impact

### Option 1 — Rubric/metric change (recommended if alert is intended to measure reasoning quality)
**Change:** exclude “unscorable / pipeline / hygiene” categories from `evaluator.low-quality-rate-24h`, and track them separately.

Concrete rubric split:
- **Substantive low-quality** (keep in main metric): wrong result, missing deliverable, broken code, no verification, etc.
- **Process/pipeline hygiene** (move to separate metrics):
  - `finish blocked by uncommitted changes`
  - `schema/query error in transcript`
  - `terminal status: interrupted/error` where root cause is runner interruption
  - `workflow live signal injection unavailable`

**Expected metric impact:** large. If the last-24h NI population is mostly these flags (as audit suggests), moving them out can plausibly drop the rate below 0.30 quickly, while still preserving visibility via new dedicated metrics.

### Option 2 — Heuristic tuning (reduce false-positive NI while retaining hygiene signal)
**Change:** replace the step-function `issues.length>0 => NI` with weighted scoring and/or stronger evidence requirements.

Examples:
- Only make hygiene flags NI if **(a)** deliverable expected AND missing, or **(b)** repeated failures (e.g., 2+ distinct hygiene flags), or **(c)** the issue is in a “hard-fail” set.
- Downgrade some flags to warnings that do not flip verdict:
  - `schema/query error in transcript` → warning unless it prevents any meaningful progress signal.
  - `metric health claim without live evidence` → warning unless the session claims metric results as the primary output.

**Expected metric impact:** medium-to-large depending on weights; would reduce the 0.55-quality cluster by preventing single-issue flips to NI.

### Option 3 — Workflow fixes (attack hygiene incidence upstream)
**Change:** reduce the rate of hygiene triggers by improving workflow guardrails and defaults.

Examples:
- “finish blocked by uncommitted changes”
  - Add a pre-finish checklist to templates.
  - Provide an automatic `git status` reminder and narrow allowlist of commit paths.
- “schema/query error in transcript”
  - Add evaluator helper snippets to always `PRAGMA table_info(...)` before querying unfamiliar tables (or provide canned queries).
- “interrupted/clean start”
  - Improve runner stability / ensure eval jobs are retried and labeled unscorable rather than NI.

**Expected metric impact:** medium and slower (behavioral + infra changes), but improves overall hygiene and reduces friction.

## 4) Recommendation
Primary recommendation is **Option 1 (rubric/metric split)** + a smaller **Option 2** tweak:
- Treat pipeline/runner-interruption and transcript-parse/schema errors as **“unscorable”** (separate metric), not automatic NI.
- Keep hygiene visibility via separate dashboards/alerts.

This aligns the alert with “reasoning/task quality” while still surfacing operational issues.
