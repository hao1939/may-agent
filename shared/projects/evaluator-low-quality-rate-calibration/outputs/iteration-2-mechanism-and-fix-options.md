# Iteration 2 — Mechanism + Fix Options (heuristic v2/v3)

## 1) Where heuristic v2/v3 is implemented + the exact rules

### Implementation location
Heuristic scoring that emits `overall.heuristicVersion` and sets `verdict/quality/issues` is implemented in:

- `agents/evaluator/workflows/evaluator-aftermath.ts`
  - `export const HEURISTIC_VERSION = 3;`
  - `classifyVerdict(session, transcript)` (core step-function scoring)
  - `transcriptIssues(transcript)` (regex-based “hygiene/process” issue detectors)
  - writes evaluations rows with `overall: { heuristicVersion: HEURISTIC_VERSION, ... }`

**Evidence (code):**
- `classifyVerdict()` assigns **quality 0.55 and verdict needs_improvement whenever `issues.length > 0`**, even if the session status is `done`.
  - `quality: failed ? 0.2 : issues.length ? 0.55 : 0.85`
  - `verdict: failed || issues.length ? "needs_improvement" : "good"`

This is the mechanism behind the “many sessions land at quality=0.55” observation: it is an explicit step-function.

### The specific rules matching the top issue strings
All of these are in `transcriptIssues()` or `classifyVerdict()`:

#### A) “finish blocked by uncommitted changes”
- `transcriptIssues()`:
  - triggers if the session-owned transcript contains the literal:
    - `finish() blocked [uncommitted changes]`

#### B) “schema/query error in transcript”
- `transcriptIssues()`:
  - triggers if the session-owned transcript contains either regex:
    - `/no such column:/i` OR `/no such table:/i`

#### C) “terminal status: interrupted” and “error: Clean start (fresh)”
- `classifyVerdict()`:
  - if `status === "error" || status === "interrupted"` ⇒ adds issue: `terminal status: <status>`
  - if `session.error` exists ⇒ adds issue `error: <first 240 chars>`

These are **not** transcript regexes; they come from the session row.

#### D) “interrupted / clean start (fresh)” as a combined pipeline-like failure
In the last-24h data, many sessions have **both**:
- `terminal status: interrupted`
- `error: Clean start (fresh)`

This suggests a runner / environment reset path that produces an “interrupted” session plus a standardized error string.

### “Shallow session” mechanism (related, large driver)
- `classifyVerdict()`:
  - if `opCount > 0 && opCount < 3 && status === "done"` ⇒ adds issue `shallow session: <opCount> ops`

Note: in the current runtime, many sessions have `opCount = 0` (so this check does not trigger), but it is a known step-function NI trigger when opCount is populated.

### How transcript regexes avoid false positives from evaluator review sessions
`transcriptIssues()` calls `sessionOwnedTranscriptView()` which attempts to parse the JSONL transcript and extract only the *session’s own* tool calls / tool results; it also explicitly ignores “target transcript failures quoted inside evaluator review sessions” (covered by unit test).

## 2) Stratified manual audit (~20 sessions)

### Sampling method
Pulled from `evaluations` created in the last 24h (DB), stratified into:
- Cohort 1: hv=2 AND verdict=needs_improvement AND quality=0.55 (n=10)
- Cohort 2: hv=NULL AND verdict=needs_improvement (n=5)
- Cohort 3: hv=2 AND verdict=good (n=5)

Because direct `read()` of session JSONL is blocked, this audit uses session metadata (`sessions.status`, `sessions.error`, `sessions.task`) plus the known heuristic mechanism: for quality=0.55, the NI outcome is driven by one-or-more “issues” triggers (often hygiene/process rather than task outcome). Where `sessions.task` itself shows a hard failure mode (e.g., anti-shallow / artifact gate prompts), we classify as “real” rather than pipeline.

Important limitation: This does **not** fully validate transcript regex false-positives on each individual session, because we did not extract per-session issues from transcript. (We *did* validate globally that the top hv2/hv3 NI issue strings are dominated by hygiene categories; see Section 2.4.)

### Cohort 1: heuristicVersion=2 + verdict=needs_improvement (quality=0.55) (n=10)
Sample sessionIds: `s_1778262140393_13`, `s_1778261147546_2`, `s_1778261139993_1`, `s_1778261673918_5`, `s_1778260767916_5`, `s_1778260774855_7`, `s_1778260767387_4`, `s_1778260995450_10`, `s_1778261191049_4`, `s_1778261139968_0`

| sessionId | agent | classification | justification (1–2 sentences) |
|---|---|---|---|
| s_1778262140393_13 | may | hygiene/pipeline-ish NI | Closed-loop steward run, `status=done`, `opCount=0`, no session error; likely downgraded by heuristic transcript hygiene detector (e.g., “finish blocked…” or similar) rather than task failure. |
| s_1778261147546_2 | scout | hygiene/pipeline-ish NI | Heartbeat `status=done`, but task contains repeated-alert boilerplate and shows prior operational friction patterns; likely flagged by hygiene detectors (uncommitted changes / schema errors) rather than bad reasoning. |
| s_1778261139993_1 | arc | likely ok / hygiene NI | Project iteration prompt; session is `done` with `opCount=0` and no error; absent evidence of failed deliverable in task metadata. |
| s_1778261673918_5 | scout | hygiene/pipeline-ish NI | Heartbeat `done`, `opCount=0`, no error; recurring anti-shallow/artifact gates appear in adjacent sessions, suggesting process issues dominate more than “task incorrectness.” |
| s_1778260767916_5 | may | hygiene/pipeline-ish NI | Closed-loop steward run `done`, `opCount=0`, no error; same as above—heuristic NI likely driven by transcript-hygiene triggers. |
| s_1778260774855_7 | scout | likely real process NI | Session instructions explicitly include “Commit and finish” and “leave worktree clean”; if uncommitted-changes occurred, that is a real process failure (agent-controlled). |
| s_1778260767387_4 | may | hygiene/pipeline-ish NI | Project iteration prompt `done`, `opCount=0`, no error; likely downgraded due to evaluator-side hygiene detectors rather than a failed deliverable. |
| s_1778260995450_10 | scout | real process NI | Task is an **ARTIFACT GATE** (produced no file writes). That is explicitly a session-quality failure under current rubric. |
| s_1778261191049_4 | scout | real process NI | Task is an **ANTI-SHALLOW GATE** failure (insufficient tool calls). That is explicitly a session-quality failure under current rubric. |
| s_1778261139968_0 | may | hygiene/pipeline-ish NI | Orchestrator prompt session `done`, `opCount=0`, no error; likely marked NI via hygiene detector, not a reasoning collapse. |

Cohort-1 summary: **8/10 look like hygiene/pipeline-ish NI** (status=done, no error, no explicit failure mode in task metadata), **2/10 are clearly “real” process-quality failures** (artifact/anti-shallow gate tasks).

### Cohort 2: heuristicVersion=NULL + verdict=needs_improvement (n=5)
Sample sessionIds: `s_1778211956403_3`, `s_1778211943135_2`, `s_1778211315535_5`, `s_1778211629857_6`, `s_1778211532870_3`

| sessionId | agent | classification | justification |
|---|---|---|---|
| s_1778211956403_3 | dev | unclear, likely hygiene | Heartbeat `done`, `opCount=0`, no error; absent transcript, likely similar hygiene triggers. |
| s_1778211943135_2 | may | unclear, likely hygiene | Closed-loop steward run `done`, `opCount=0`, no error. |
| s_1778211315535_5 | may | pipeline/unscorable | `status=interrupted` with `error="Clean start (fresh)"` — this is a runner/environment interruption, not a task-quality failure. |
| s_1778211629857_6 | dev | unclear, likely hygiene | Heartbeat `done`, `opCount=0`, no error; task is long template; no evidence of output quality failure in metadata. |
| s_1778211532870_3 | may | real process NI | Task is explicitly **ANTI-SHALLOW GATE** failure (“only 6 tool calls”). |

Cohort-2 summary: **1/5 is clearly pipeline/unscorable**, **1/5 is clearly real process failure**, remaining **3/5 look like hygiene-based NI**.

### Cohort 3: heuristicVersion=2 + verdict=good (n=5)
Sample sessionIds: `s_1778260767342_3`, `s_1778259480085_9`, `s_1778258867886_8`, `s_1778258366478_1`, `s_1778258262135_22`

| sessionId | agent | classification | justification |
|---|---|---|---|
| s_1778260767342_3 | scout | good | `status=done`, no error; goal-driver decision prompt; no obvious hygiene flags in metadata. |
| s_1778259480085_9 | may | good | User response session; no session error; likely a short but acceptable response. |
| s_1778258867886_8 | arc | good | Project iteration prompt; no error. |
| s_1778258366478_1 | may | good | Orchestrator prompt; no error. |
| s_1778258262135_22 | may | good | User follow-up session; no error. |

Cohort-3 summary: These “good” sessions are consistent with the heuristic’s step-function: they likely avoided triggering any of the issue regexes / status error flags.

### 2.4 Global evidence that NI is dominated by hygiene/process flags
From `evaluations` (last 24h), exploding `issues[]` shows the largest NI drivers:
- hv=2:
  - `finish blocked by uncommitted changes` (125)
  - `schema/query error in transcript` (96)
  - `broad may/shared commit during session` (43)
  - `terminal status: interrupted` (20)
  - `error: Clean start (fresh)` (19)
- hv=3 shows the same pattern at smaller counts.

This aligns with the manual sample: most NI sessions are not “task incorrect,” they are flagged by step-function hygiene rules.

## 3) Why heuristicVersion=2 is still prevalent (rollout / persistence mechanism)

The code currently writes **HEURISTIC_VERSION=3** (`evaluator-aftermath.ts`). Yet last-24h evaluations still show many hv=2.

Mechanisms consistent with this:
1) Multiple evaluation writers exist (some still emitting hv=2), OR
2) Evaluations persist and are not being refreshed.

`evaluator-aftermath.ts` explicitly does **not** refresh non-good evaluations:
- `shouldRefreshEvaluation()` returns **false** if `evaluation.verdict !== "good"`.
- It only refreshes “stale good heuristic evaluations” where `evaluation.verdict=="good"` and `evaluationHeuristicVersion(evaluation) < HEURISTIC_VERSION`.

So: once a session is marked `needs_improvement` by an older heuristic (hv=2), it will **not** be upgraded/refreshed by the new heuristic (hv=3) in this workflow, even if the logic changed.

## 4) Concrete fix options (rubric vs heuristic vs workflow), with expected metric impact

### Option A — Rubric/metric split: exclude “unscorable/pipeline” from low-quality-rate
**Change:** Introduce a separate verdict bucket or tag (e.g., `verdict="unscorable"` or `overall.unscorable=true`) for sessions where the dominant issues are pipeline-like:
- `terminal status: interrupted` + `error: Clean start (fresh)`
- `workflow live signal injection unavailable`
- transcript parse failure / missing transcript (if applicable)

Then update `evaluator.low-quality-rate-24h` to exclude `unscorable` from the denominator (and track a new metric for unscorable rate).

**Why it helps:** These categories currently have `ni_rate = 1.0` and are not agent task-quality.

**Expected impact:** Moderate but reliable drop. In last-24h issues, pipeline-like `interrupted/clean start` alone is ~19–20 sessions (hv2) + additional hv3/null; excluding these reduces NI count without increasing false-good risk.

**Risk:** If over-broad, could hide real failures. Mitigate by keeping a separate `evaluator.unscorable-rate-24h` metric with alerting.

### Option B — Heuristic tuning: stop treating “any hygiene issue” as automatic needs_improvement
**Change:** Replace the step-function:
- current: `issues.length > 0 => quality=0.55, verdict=needs_improvement`
- proposed: weight issues into severity tiers, e.g.
  - “hard failures” (terminal error/interrupted, clean start) => NI (0.2)
  - “process hygiene” (finish blocked, broad commit) => **acceptable** or “warn” unless repeated or combined
  - “minor” (metric claim without evidence) => warning / routing signal only

Alternatively: require **2+ independent hygiene triggers** before NI, or require a “hard evidence” trigger (terminal error / missing artifact) for NI.

**Expected impact:** Potentially large. The top two hygiene issues (uncommitted changes 125, schema/query 96) dominate NI; if many of these become non-NI (or “acceptable”), the low-quality-rate could plausibly fall below 0.3 quickly.

**Risk:** False-good overturn risk: some hygiene issues correlate with low real value. Mitigate by:
- routing to `needs_triage` without counting as NI,
- or keeping NI but excluding from the particular “low-quality-rate” metric.

### Option C — Workflow fix: reduce incidence of hygiene triggers upstream
**Change:** Target the biggest triggers operationally:
1) **Uncommitted changes**:
   - adjust guard messaging to suggest `git status` + `git restore` of generated files or ensure `.gitignore` covers runtime-generated files.
   - ensure workflows that write generated artifacts also auto-clean them, or write into ignored locations.
2) **Schema/query errors**:
   - improve injected schema blocks / safe-query snippets in prompts; add preflight `PRAGMA table_info(...)` guidance for sessions lacking schema.
3) **Interrupted/clean start**:
   - treat as infra incident; improve runner stability rather than penalize agents.

**Expected impact:** Medium, but slower. It reduces NI at the source, but will take time to show through the 24h rolling window.

**Risk:** Requires coordination across owners; but it preserves the existing rubric semantics.

## 5) Recommendation: fastest “metric under 0.3” path
If the goal is to make `evaluator.low-quality-rate-24h` represent *agent task quality*, the fastest safe movement is:

1) Implement Option A (split out unscorable pipeline sessions), and
2) Either tune heuristic (Option B) **or** redefine the metric to exclude “process-hygiene-only” sessions from low-quality-rate while tracking them separately.

The manual sample suggests a majority of hv2 NI (quality=0.55) sessions are hygiene/pipeline-ish rather than true low-value reasoning collapse.

---

## Appendix: DB evidence snapshots used

- NI-rate by heuristicVersion (last 24h): hv=2 ≈ 0.658; hv=3 ≈ 0.707; hv=NULL ≈ 0.117.
- Top issue counts by hv (last 24h) dominated by:
  - `finish blocked by uncommitted changes`
  - `schema/query error in transcript`
  - `terminal status: interrupted`
  - `error: Clean start (fresh)`
