# Iteration 2 — Mechanism + Fix Options (Heuristic v2 “hygiene NI”)

## Executive summary

We can now pin down **mechanism → rule → trigger** for the top “hygiene/process” `needs_improvement` (NI) sessions.

- **Where implemented**: `agents/evaluator/workflows/evaluator-aftermath.ts`.
- **How it works**: `classifyVerdict()` marks a session `needs_improvement` with `quality=0.55` **if _any_ heuristic “issue” is present**, even when the session `status=done` and the underlying work may be fine.
- **Why top issues dominate**: `transcriptIssues()` is a set of regex detectors that add issues for:
  - `finish() blocked [uncommitted changes]`
  - `no such column:` / `no such table:` (schema/query errors)
  - `terminal status: interrupted` (session status, not transcript)
  - plus “broad commit” and “committed generated runtime files”

This supports the hypothesis that the breach is largely driven by **hygiene flags being treated as NI** (and treated equivalently to real task failure), rather than a sudden collapse in task reasoning.

---

## A) Where heuristic v2 is implemented + the specific rules

### Location
- **Module**: `agents/evaluator/workflows/evaluator-aftermath.ts`
  - Exports: `classifyVerdict`, `transcriptIssues`, `HEURISTIC_VERSION`.

### Versioning
- Current code constant: `export const HEURISTIC_VERSION = 3;` (so “v2” is an older/previously-shipped heuristic JSON value).
- The evaluation’s heuristic version is read from `evaluations.overall` JSON via:
  - `evaluationHeuristicVersion(evaluation)` → `json.heuristicVersion`.

### Rule: “finish blocked by uncommitted changes”
In `transcriptIssues(transcript)`:
```ts
if (ownText.includes("finish() blocked [uncommitted changes]")) {
  issues.push("finish blocked by uncommitted changes");
}
```
Mechanism: any occurrence in the **session-owned transcript view** triggers the issue.

### Rule: “schema/query error in transcript”
In `transcriptIssues(transcript)`:
```ts
if (/no such column:/i.test(ownText) || /no such table:/i.test(ownText)) {
  issues.push("schema/query error in transcript");
}
```
Mechanism: catches common SQLite errors when agents guess columns/tables.

Important nuance (false-positive mitigation exists):
- `sessionOwnedTranscriptView()` tries to exclude errors that are merely *quoted* from another session’s transcript by only considering:
  - the assistant’s own tool call arguments and some toolResult text,
  - and by ignoring arbitrary “read other transcript” content (it emits `SESSION_READ_BLOCKED_OR_ATTEMPTED` marker instead).
- A unit test asserts this intended mitigation: `"ignores target transcript failures quoted inside evaluator review sessions"`.

### Rule: “interrupted / terminal status”
In `classifyVerdict(session, transcript)`:
```ts
if (status === "error" || status === "interrupted") issues.push(`terminal status: ${status}`);
...
const failed = status === "error" || status === "interrupted" || !!session?.error;
return {
  quality: failed ? 0.2 : issues.length ? 0.55 : 0.85,
  verdict: failed || issues.length ? "needs_improvement" : "good",
  issues,
};
```
Mechanism:
- `interrupted` and `error` are treated as **hard failures** with `quality=0.2`.
- “done but has any issues” is treated as **NI with `quality=0.55`**.

### “Shallow session:*” (opCount-based)
Also in `classifyVerdict`:
```ts
if (opCount > 0 && opCount < 3 && status === "done") issues.push(`shallow session: ${opCount} ops`);
```
This explains the “shallow_session:*” issue category in the metric breach.

---

## B) Stratified manual audit (n≈20)

Method:
- Selected sessions from the last 24h using `sessions JOIN evaluations` and heuristicVersion extracted from `evaluations.overall` JSON.
- For each session, inspected the **stored transcript** in `.state/sessions/history/<sessionId>/session.jsonl` and compared what happened vs the heuristic “issue” label.

### Cohort 1: heuristicVersion=2 + verdict=needs_improvement (quality≈0.55) (n=10)

These are “done but any issue ⇒ NI” cases.

1) `s_1778262140393_13` (agent=may)
- Issues: finish blocked by uncommitted changes; broad may/shared commit; committed generated runtime files
- Manual judgment: **Hygiene/process failure, not task-quality.** The work was an audit, but the session tripped guard rails and committed generated runtime artifacts.

2) `s_1778261673918_5` (agent=scout)
- Issues: schema/query error in transcript
- Manual judgment: **Hygiene failure.** Transcript begins with `query_db` error “no such column: id” due to guessing schema.

3) `s_1778261191049_4` (agent=scout)
- Issues: finish blocked by uncommitted changes
- Manual judgment: **Hygiene failure.** Session ended with uncommitted local changes that blocked finish.

4) `s_1778261147546_2` (agent=scout)
- Issues: schema/query error in transcript
- Manual judgment: **Hygiene failure.** Same pattern: invalid SQL column reference.

5) `s_1778261139993_1` (agent=arc)
- Issues: finish blocked by uncommitted changes
- Manual judgment: **Hygiene failure.** Attempted run left dirty state; finish blocked.

6) `s_1778261139968_0` (agent=may)
- Issues: finish blocked by uncommitted changes; broad may/shared commit
- Manual judgment: **Hygiene failure.** “Observation-only” attempt but did operations that dirtied project file and tripped finish guard.

7) `s_1778260995450_10` (agent=scout)
- Issues: finish blocked by uncommitted changes
- Manual judgment: **Hygiene failure.** Artifact gate forced a write; then finish blocked because the agent didn’t commit the change.

8) `s_1778260937494_9` (agent=scout)
- Issues: schema/query error in transcript
- Manual judgment: **Hygiene failure.** Query uses `ORDER BY id` on `sessions` table which does not have `id`.

9) `s_1778260774855_7` (agent=scout)
- Issues: finish blocked by uncommitted changes
- Manual judgment: **Likely hygiene failure.** Session appears to do real file edits, but earlier/elsewhere left uncommitted changes.

10) `s_1778260767949_6` (agent=may)
- Issues: finish blocked by uncommitted changes
- Manual judgment: **Hygiene failure.** Work was metric triage; transcript shows broad filesystem searches and didn’t reach clean finish.

**Cohort 1 takeaway:** In the sampled v2 NI @ 0.55 cases, **~10/10 are primarily hygiene/guard problems**, not “the task was wrong.”

### Cohort 2: heuristicVersion=NULL + verdict=needs_improvement (n=5)

Selected from recent NULL/0 heuristicVersion NI sessions. These still show the same hygiene patterns, implying this isn’t purely “v2 is harsh”; it’s “hygiene flags are being treated as NI at all.”

11) `s_1778211956403_3` (agent=dev)
- Issues: schema/query error in transcript; committed generated runtime files
- Manual judgment: **Hygiene failure.** Mistyped schema + committed runtime artifacts.

12) `s_1778211943135_2` (agent=may)
- Issues: schema/query error in transcript
- Manual judgment: **Hygiene failure.** Column/table guess.

13) `s_1778211629857_6` (agent=dev)
- Issues: finish blocked; schema/query error; broad commit; committed runtime files; workflow live signal injection unavailable
- Manual judgment: **Pipeline/process failure.** Multiple hygiene + reliability issues; not a clean evaluated “task quality” signal.

14) `s_1778211532870_3` (agent=may)
- Issues: schema/query error in transcript
- Manual judgment: **Hygiene failure.** Schema guess.

15) `s_1778211482795_0` (agent=may)
- Issues: schema/query error in transcript
- Manual judgment: **Hygiene failure.** Schema guess.

### Cohort 3: heuristicVersion=2 + verdict=good (n=5)

These are “no issues detected” sessions. We didn’t deep-audit deliverables here; we only verified that the heuristic is not auto-failing all v2 sessions.

16) `s_1778260767342_3` (agent=scout)
- Issues: []
- Manual judgment: **Looks fine by heuristic.** No schema/finish errors detected.

17) `s_1778259480085_9` (agent=may)
- Issues: []
- Manual judgment: **Looks fine by heuristic.**

18) `s_1778258867886_8` (agent=arc)
- Issues: []
- Manual judgment: **Looks fine by heuristic.**

19) `s_1778258840512_6` (agent=dev)
- Issues: []
- Manual judgment: **Looks fine by heuristic.**

20) `s_1778258730407_2` (agent=may)
- Issues: []
- Manual judgment: **Looks fine by heuristic.**

---

## C) Causality conclusion

**Mechanism confirmed**:
- The heuristic evaluator **equates hygiene/guard failures with NI** by design: `issues.length > 0 ⇒ verdict=needs_improvement, quality=0.55`.
- The top “issues” are produced by **simple regex triggers** in `transcriptIssues()` plus status/opCount logic in `classifyVerdict()`.

**Not confirmed yet** (needs next iteration / broader sample):
- Whether `heuristicVersion=2` is uniquely responsible vs “heuristic scoring in general,” because the code currently reports `HEURISTIC_VERSION=3`, and a large volume of NI sessions have `heuristicVersion=null`.

---

## D) Fix options (rubric vs heuristic vs workflow) + expected metric impact

### Option 1 — Rubric/metric change: split “unscorable/hygiene” from “low quality output”

**Change**: Modify the metric `evaluator.low-quality-rate-24h` so it excludes sessions whose NI verdict is driven *only* by the hygiene/process bucket.
- Create a new verdict or flag bucket: `unscorable` (or `hygiene_failure`) for:
  - `schema/query error in transcript`
  - `finish blocked by uncommitted changes`
  - `terminal status: interrupted`
  - `workflow live signal injection unavailable`
- Track a separate metric: `evaluator.unscorable-rate-24h` (or `evaluator.hygiene-failure-rate-24h`) and alert on it.

**Expected impact**:
- High immediate drop in `evaluator.low-quality-rate-24h` because dominant categories (`shallow session:*`, schema/query errors, finish-blocked, interrupted) would move out of the “quality” numerator.
- Risk: could mask real agent problems unless the new metric is treated as first-class.

### Option 2 — Heuristic tuning: require stronger evidence before NI (or lower penalty)

**Change** (tuning inside `classifyVerdict`):
- Keep recording hygiene issues, but **don’t auto-NI** for a single hygiene issue on an otherwise “done” session.
  - Example: if `status=done` and issues are only in `{schema/query error in transcript, finish blocked by uncommitted changes}`, set `verdict='acceptable'` or `verdict='needs_triage'` rather than NI.
- Alternatively: set `quality=0.7` for hygiene-only issues, reserving `0.55` for multi-issue or output-quality issues.

**Expected impact**:
- Moderate-to-high drop in NI-rate for heuristic-evaluated sessions.
- Maintains visibility of hygiene failures via `issues` while not dragging the global low-quality metric.

### Option 3 — Workflow fix: reduce incidence of these hygiene failures at the source

**Change**:
- Fix the top workflows/agents causing:
  - schema guessing (`ORDER BY id` on sessions, selecting non-existent columns)
  - finish blocked (uncommitted changes) and accidental broad commits

Concrete workflow interventions:
- Enforce schema injection / safe query examples in more prompts (already exists in some crons, but not consistently followed).
- Add a lightweight “pre-flight” snippet in agent manuals: `query_db(PRAGMA table_info(...))` before ad-hoc `SELECT`.
- Improve the finish guard instructions so agents learn: if finish is blocked, either commit the intentional changes or `git checkout -- <file>`; don’t broad-add `shared/`.

**Expected impact**:
- Slower but more “real” improvement: reduces hygiene failures rather than reclassifying them.
- Likely improves multiple metrics (`scout.operational-friction-rate-24h`, project invalid-format, etc.)

---

## E) Suggested next step (Iteration 3)

1) Quantify how many NI sessions are **hygiene-only** vs mixed vs real task failure:
   - Parse `evaluations.issues` JSON and compute buckets.
2) Decide whether `evaluator.low-quality-rate-24h` is intended to include hygiene.
   - If not intended: implement Option 1.
   - If intended: implement Option 3 (and maybe Option 2 as a compromise).

---

## Evidence references (tool outputs)

- Implementation file: `agents/evaluator/workflows/evaluator-aftermath.ts` (read)
- Unit tests that assert behavior: `agents/shared/tests/evaluator-aftermath.test.ts` (read)
- Session transcripts sampled:
  - `.state/sessions/history/s_1778262140393_13/session.jsonl` (contains finish-blocked + broad commit + runtime file commit)
  - `.state/sessions/history/s_1778260937494_9/session.jsonl` (contains query_db error “no such column: id”)
  - plus additional sampled transcripts listed above.
