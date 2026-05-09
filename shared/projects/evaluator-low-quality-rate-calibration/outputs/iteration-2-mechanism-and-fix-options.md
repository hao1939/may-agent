# Iteration 2 — Mechanism + Fix Options (heuristic v2)

## 1) Where heuristic v2 is implemented + the exact rules

### 1.1 Primary implementation (classification + issue extraction)
**File:** `agents/evaluator/workflows/evaluator-aftermath.ts`

Key functions:
- `transcriptIssues(transcript: string): string[]` — extracts *hygiene / pipeline* issue strings by pattern-matching the transcript.
- `classifyVerdict(session, transcript)` — converts session fields + transcript issues into `(quality, verdict, issues)`.

**Step-function scoring rule (main driver of “quality=0.55”):**
```ts
const failed = status === "error" || status === "interrupted" || !!session?.error;
return {
  quality: failed ? 0.2 : issues.length ? 0.55 : 0.85,
  verdict: failed || issues.length ? "needs_improvement" : "good",
  issues,
};
```
Meaning:
- Any `status in {error, interrupted}` or any non-null `session.error` ⇒ `quality=0.2` + `needs_improvement`.
- Else, **any non-empty `issues[]`** ⇒ `quality=0.55` + `needs_improvement`.
- Else ⇒ `quality=0.85` + `good`.

### 1.2 Rules corresponding to the top NI “issues”
All are in `transcriptIssues()` unless otherwise noted:

#### A) “finish blocked by uncommitted changes”
**Rule:**
```ts
if (ownText.includes("finish() blocked [uncommitted changes]")) {
  issues.push("finish blocked by uncommitted changes");
}
```
This is a pure transcript substring match: any `finish()` toolResult containing that phrase triggers NI.

#### B) “schema/query error in transcript”
**Rule:**
```ts
if (/no such column:/i.test(ownText) || /no such table:/i.test(ownText)) {
  issues.push("schema/query error in transcript");
}
```
This is a regex match over the “session-owned transcript view” (includes assistant text + tool calls, and for `query_db` toolResults includes the tool output text).

#### C) “terminal status: interrupted” + “error: Clean start (fresh)”
These are from **session table fields**, not transcript parsing:
```ts
if (status === "error" || status === "interrupted") issues.push(`terminal status: ${status}`);
if (session?.error) issues.push(`error: ${String(session.error).slice(0, 240)}`);
```
So if `sessions.status='interrupted'` and `sessions.error='Clean start (fresh)'`, the heuristic deterministically emits those issues and assigns `quality=0.2`.

### 1.3 Where heuristicVersion=2 is applied / rolled out (refresh mechanics)
**File:** `agents/may/handlers/session-aftermath-scan.ts`

- This cron is a fallback: it re-runs evaluation for terminal sessions that have **no** evaluation, *or* have a **good** evaluation with a lower heuristic version.
- Default config uses:
```ts
const DEFAULT_HEURISTIC_VERSION = 2;
```
- Critically, the refresh condition is:
```sql
e.sessionId IS NULL
OR (e.verdict = 'good' AND json_extract(e.overall,'$.heuristicVersion') < ?)
```
So **needs_improvement evaluations do not get refreshed** when heuristic versions bump (“NI-sticky”). This can inflate/extend the impact of an overly-harsh v2 if it is the first heuristic to label a session NI.

---

## 2) Stratified manual audit (n=20)

Method:
- Stratified by `(heuristicVersion, verdict)` using `evaluations.overall -> $.heuristicVersion`.
- For each sampled session, checked:
  - DB `evaluations.issues` (root cause category)
  - For a few representative ones, verified by grepping the transcript JSONL for the triggering phrase.

### Legend
- **Substantive low-quality** = task outcome appears wrong/incomplete (not just hygiene)
- **Hygiene/process** = guard/commit/tooling hygiene failure dominates; outcome may be unknown
- **Unscorable/pipeline** = interrupted/clean start, query schema errors, etc. where the “NI” is mostly a pipeline signal, not an agent capability signal

### 2.1 hv=2 + verdict=needs_improvement (10)
| sessionId | q | issues (abridged) | classification | justification |
|---|---:|---|---|---|
| s_1778262140393_13 | 0.55 | finish blocked; broad may/shared commit; committed runtime files | Hygiene/process | Transcript contains explicit `finish() blocked [uncommitted changes]` (verified by grep). NI is from guard failure, not task reasoning quality. |
| s_1778261147546_2 | 0.55 | schema/query error | Unscorable/pipeline | `query_db` toolResult contains `no such column: id` (verified by grep). This is likely a schema introspection mistake; hard to infer task outcome quality. |
| s_1778261139993_1 | 0.55 | finish blocked | Hygiene/process | Pure finish guard hygiene; evaluation step-function assigns 0.55 if any issue exists. |
| s_1778261255980_7 | 0.20 | terminal interrupted; error Clean start (fresh) | Unscorable/pipeline | Session table has `status=interrupted` and `error=Clean start (fresh)`; heuristic deterministically sets q=0.2. This reflects runner interruption, not task outcome. |
| s_1778261317514_9 | 0.20 | terminal interrupted; Clean start; schema/query error | Unscorable/pipeline | Same interruption + additional query error; dominated by inability to complete a run. |
| s_1778261673918_5 | 0.55 | schema/query error | Unscorable/pipeline | Same regex trigger; without further artifact review, this reads as tooling/schema mismatch rather than reasoning collapse. |
| s_1778260767916_5 | 0.55 | finish blocked; broad commit | Hygiene/process | Triggered by finish guard + risky commit pattern; outcome unknown but the failure mode is process hygiene. |
| s_1778260774855_7 | 0.55 | finish blocked | Hygiene/process | Again a finish guard failure; this is explicitly process. |
| s_1778260767387_4 | 0.55 | schema/query error | Unscorable/pipeline | Query error pattern; tends to be a brittle trigger (regex) and frequently not an actual “task failure.” |
| s_1778260995450_10 | 0.55 | finish blocked | Hygiene/process | Finish guard. |

**Audit take-away:** 10/10 are dominated by hygiene/pipeline flags rather than clear substantive task failure.

### 2.2 hv=NULL + verdict=needs_improvement (5)
| sessionId | q | issues (abridged) | classification | justification |
|---|---:|---|---|---|
| s_1778211956403_3 | 0.55 | schema/query error; committed runtime files | Hygiene/process | Same trigger set; still process/tooling. |
| s_1778211943135_2 | 0.55 | schema/query error | Unscorable/pipeline | Query error; outcome unclear. |
| s_1778211315535_5 | 0.20 | interrupted; Clean start; schema/query error | Unscorable/pipeline | Runner interruption dominates. |
| s_1778211629857_6 | 0.55 | finish blocked; schema/query error; broad commit; runtime files; live signals unavailable | Hygiene/process | A pileup of hygiene flags; not a reasoning-quality diagnosis. |
| s_1778211532870_3 | 0.55 | schema/query error | Unscorable/pipeline | Query error. |

**Audit take-away:** 5/5 also look hygiene/pipeline dominated.

### 2.3 hv=2 + verdict=good (5)
| sessionId | q | issues | classification | justification |
|---|---:|---|---|---|
| s_1778260767342_3 | 0.85 | [] | Likely OK | No heuristic issues; by definition the heuristic sees no transcript/session red flags. |
| s_1778259480085_9 | 0.85 | [] | Likely OK | Same. |
| s_1778258867886_8 | 0.85 | [] | Likely OK | Same. |
| s_1778258366478_1 | 0.85 | [] | Likely OK | Same. |
| s_1778258262135_22 | 0.85 | [] | Likely OK | Same. |

**Note:** “good” here only means “no detected red flags,” not that the task outcome is verified high-quality; but it does show the NI spike is concentrated in the specific hygiene/pipeline triggers above.

---

## 3) Fix options (interventions) + expected metric impact

### Option 1 — Rubric/metric change (separate “substantive” vs “hygiene/unscorable”)
**Change:** Define/alert on a *substantive* low-quality metric that excludes:
- interruptions / runner errors (`status in {error, interrupted}` or `session.error` set)
- schema/query errors
- finish blocked / git hygiene issues
…while still tracking those in separate reliability metrics.

**Expected impact:** Large immediate reduction in `evaluator.low-quality-rate-24h`-style paging pressure if the alert pivots to substantive failures. In the audited slice, 15/15 NI examples were hygiene/unscorable dominated; excluding them would push the effective NI rate far closer to actual task-quality failures.

**Risk:** If hygiene issues are actually critical to product quality, excluding them could hide real problems. Mitigation: introduce parallel “pipeline reliability” metrics with their own thresholds.

### Option 2 — Heuristic tuning (reduce false-positive / brittle triggers)
**Change ideas:**
1) Replace the step-function `issues.length>0 => NI` with a weighted scoring scheme, e.g.:
   - “finish blocked” counts as *process warning* but does not force NI unless combined with other evidence.
   - “schema/query error” only counts if it aborts the session goal (e.g., repeated errors, or no subsequent successful query).
2) Add a new verdict bucket: `unscorable` for `(status=interrupted OR error contains 'Clean start')` and exclude from low-quality rate.

**Expected impact:** Moderate-to-large reduction in NI rate; would especially reduce the mass of quality=0.55 sessions.

**Risk:** More complex heuristic = harder to maintain; needs unit tests (there are evaluator aftermath tests in `agents/shared/tests/evaluator-aftermath.test.ts`).

### Option 3 — Workflow/source fixes (reduce incidence of the triggers)
**Change:** Reduce upstream hygiene failures so the existing heuristic rubric is satisfied more often:
- Prevent writing to gitignored `agents/shared/projects/**` during normal sessions (or ensure outputs land in a committable workspace).
- Add a standard “schema first” snippet and enforce it in templates to avoid `no such column/table` query errors.
- Investigate/mitigate “Clean start (fresh)” interruptions (runner stability).

**Expected impact:** Slower but durable reduction. If “finish blocked” and “schema/query error” dominate NI counts, cutting their incidence could substantially reduce the broad low-quality metric without changing rubric.

**Risk:** Some causes (runner interruptions) may be outside agent control; needs owner escalation.

---

## 4) Answers to the iteration questions (as-of this artifact)

1) **Is the goal closer?** No—this iteration is a mechanism audit; it does not change the metric yet.
2) **What did we learn?** The dominant v2 NI labels are mechanically produced by a small set of brittle transcript/session-field triggers, and the scoring is a step-function (any issue => NI/q=0.55).
3) **Is the current milestone the right next step?** Yes—mechanism is now pinned down with file/module + rule strings.
4) **Are we closing the loop?** Closer: we now have concrete levers (metric split, heuristic reweight, workflow fixes).
5) **Is it verified?** Partially: we verified rule locations via source inspection, and verified several trigger phrases directly in transcripts with grep.
6) **What’s blocking progress?** No external blocker; next step is choosing the intervention owner (rubric vs heuristic vs workflow) and implementing with tests + alerting alignment.
