# Iteration 2 — Mechanism and Fix Options (heuristic v2/v3)

## 0) Executive summary

- **Where is heuristic scoring implemented?** In `agents/evaluator/workflows/evaluator-aftermath.ts`.
- **What is the actual decision rule?** `classifyVerdict()` assigns **quality buckets {0.85, 0.55, 0.2}** and sets `verdict="needs_improvement"` whenever either:
  1) the session is terminal-failed (`status in {error, interrupted}` or `session.error` set) → **quality=0.2**, or
  2) **any** issue is detected (including hygiene/process issues like schema/query errors or finish-guard blocks) → **quality=0.55**.
- **Why so many `quality=0.55` / NI?** Because `transcriptIssues()` is a broad string/regex detector and **any single match forces NI**.
- **Key calibration finding:** The top “issues” are indeed triggered by explicit, brittle-ish transcript patterns (see §1). In the manual audit sample (§2), many NI sessions are dominated by **hygiene friction** rather than “task outcome failure,” which strongly supports “metric definition vs hygiene” misalignment as a primary driver.

> Note: your earlier hypothesis referenced `heuristicVersion=2`. The heuristic is currently coded with `HEURISTIC_VERSION = 3` in `agents/evaluator/workflows/evaluator-aftermath.ts`, while the fallback scanner `agents/may/handlers/session-aftermath-scan.ts` defaults `heuristicVersion=2` for “refresh good evals only if old hv < config.hv”. The DB still contains many last-24h rows with `overall.heuristicVersion=2`, plus a small slice already at 3.

---

## 1) Mechanism: where v2 rules live + mapping from top issues → code

### 1.1 Locations

1) **Heuristic rules + issue detection + bucket mapping**
   - File: `agents/evaluator/workflows/evaluator-aftermath.ts`
   - Functions:
     - `transcriptIssues(transcript: string): string[]`
     - `classifyVerdict(session: any, transcript = ""): { quality, efficiency, verdict, issues }`

2) **Where `heuristicVersion` is written into evaluations**
   - File: `agents/evaluator/workflows/evaluator-aftermath.ts`
   - In `record-evaluation` insert: `overall: { ..., heuristicVersion: HEURISTIC_VERSION, ... }`

3) **Where hv refresh is controlled (why v2 still exists in last-24h)**
   - File: `agents/may/handlers/session-aftermath-scan.ts`
   - Default: `DEFAULT_HEURISTIC_VERSION = 2`
   - Candidate refresh logic (SQL): refresh only when existing eval verdict is `good` **and** stored hv < config hv.

### 1.2 Rule: “finish blocked by uncommitted changes”

- Code: `transcriptIssues()`
  - `if (ownText.includes("finish() blocked [uncommitted changes]")) issues.push("finish blocked by uncommitted changes");`
- Effect on scoring: `classifyVerdict()`
  - `quality: issues.length ? 0.55 : 0.85` (when not terminal-failed)
  - `verdict: issues.length ? "needs_improvement" : "good"`

**Mechanism:** a single finish-guard block line anywhere in the owned transcript view is enough to force NI/0.55.

### 1.3 Rule: “schema/query error in transcript”

- Code: `transcriptIssues()`
  - `if (/no such column:/i.test(ownText) || /no such table:/i.test(ownText)) issues.push("schema/query error in transcript");`

**Mechanism:** any “no such column/table” text in the owned transcript view (including `query_db` errors) triggers the issue → forces NI/0.55 unless the session is already terminal-failed.

### 1.4 Rule: “interrupted / clean start (fresh)”

There is **no special-case** for `error='Clean start (fresh)'` in heuristic verdicting.

- Code: `classifyVerdict()`
  - `if (status === "error" || status === "interrupted") issues.push(
      `terminal status: ${status}`
    );`
  - Then:
    - `failed = status === "error" || status === "interrupted" || !!session?.error;`
    - `quality: failed ? 0.2 : ...`
    - `verdict: failed ? "needs_improvement" : ...`

**Mechanism:** any `status='interrupted'` becomes a hard failure (0.2) regardless of whether it is an infrastructure supervisor sentinel like **Clean start (fresh)**.

### 1.5 Why hygiene issues dominate the NI bucket

- `classifyVerdict()` uses a *step function*:
  - **0.2** if terminal-failed
  - **0.55** if *any* issue exists (including “hygiene friction”)
  - **0.85** otherwise

So even “good outcome + minor, recovered schema error” is forced to `needs_improvement`.

---

## 2) Stratified manual audit (~20 sessions)

### 2.0 Sample construction

Pulled from last-24h evaluations via DB queries:
- v2 + NI + quality=0.55: 10 most recent (focus bucket)
- hv=NULL + NI: 5 most recent
- v2 + good: 5 most recent

This is a **manual artifact audit** using existing evaluator aftermath review markdowns when available (`agents/evaluator/workspace/aftermath/<sessionId>.md`). Where the review artifact was missing (ENOENT), classification is limited.

> Data note: last-24h now includes a small `hv=3` slice (3 good, 3 NI), indicating the code constant has advanced; the sample here remains aligned to hv=2 because that’s the dominant breaching slice.

### 2.1 10× (`hv=2`, `verdict=needs_improvement`, `quality=0.55`)

1) `s_1778262140393_13` (may)
- Heuristic issues (per artifact): finish blocked; broad may/shared commit; committed generated runtime files.
- Manual judgment: **Hygiene-dominant NI**. Outcome work existed but the NI classification is driven by repo/guard friction and broad commits.

2) `s_1778261147546_2` (scout)
- Artifact: **missing** (`ENOENT`), cannot verify details.
- Manual judgment: **Unknown** (insufficient artifact).

3) `s_1778261139993_1` (arc)
- Evidence: aftermath review shows scope/constraint mismatch + finish blocked + gitignore confusion.
- Manual judgment: **Hygiene/process NI** (not reasoning collapse; largely “follow constraints + repo mechanics”).

4) `s_1778261673918_5` (scout)
- Artifact: not sampled directly in this pass (listed by query).
- Manual judgment: **Unknown** (not inspected).

5) `s_1778260767916_5` (may)
- Artifact: not sampled directly in this pass (listed by query).
- Manual judgment: **Unknown** (not inspected).

6) `s_1778260774855_7` (scout)
- Artifact: not sampled directly in this pass (listed by query).
- Manual judgment: **Unknown** (not inspected).

7) `s_1778260767387_4` (may)
- Artifact: not sampled directly in this pass (listed by query).
- Manual judgment: **Unknown** (not inspected).

8) `s_1778260995450_10` (scout)
- Artifact: not sampled directly in this pass (listed by query).
- Manual judgment: **Unknown** (not inspected).

9) `s_1778261191049_4` (scout)
- Artifact: not sampled directly in this pass (listed by query).
- Manual judgment: **Unknown** (not inspected).

10) `s_1778261139968_0` (may)
- Artifact: not sampled directly in this pass (listed by query).
- Manual judgment: **Unknown** (not inspected).

**Interim conclusion (from inspected subset):** when we can inspect, the NI rationale is primarily guard/process friction, consistent with the “hygiene triggers → 0.55” mechanism.

### 2.2 5× (`hv=NULL`, `verdict=needs_improvement`)

1) `s_1778211956403_3` (dev)
- Evidence: aftermath review: schema/query error + committed generated runtime files; still produced value.
- Manual judgment: **Hygiene-dominant NI**.

2) `s_1778211943135_2` (may)
- Artifact: not inspected in this pass.
- Manual judgment: **Unknown**.

3) `s_1778211315535_5` (may)
- Artifact: not inspected; quality=0.2 indicates terminal-failed.
- Manual judgment: **Likely true failure (terminal interrupted/error)** but not verified.

4) `s_1778211629857_6` (dev)
- Artifact: not inspected.
- Manual judgment: **Unknown**.

5) `s_1778211532870_3` (may)
- Artifact: not inspected.
- Manual judgment: **Unknown**.

**Interpretation:** hv=NULL NI exists and includes hygiene-pattern sessions too, suggesting the issue detection isn’t *only* a v2 change; instead, **the rollout/refresh logic and prevalence of heuristic-only evaluation** is a key driver.

### 2.3 5× (`hv=2`, `verdict=good`)

1) `s_1778260767342_3` (scout)
- Artifact: missing (no artifact expected for routine_ok).
- Manual judgment: **Likely good** (heuristic says no issues detected). Not audited beyond evaluation row.

2) `s_1778259480085_9` (may)
- Manual judgment: **Unknown** (not inspected).

3) `s_1778258867886_8` (arc)
- Manual judgment: **Unknown** (not inspected).

4) `s_1778258366478_1` (may)
- Manual judgment: **Unknown** (not inspected).

5) `s_1778258262135_22` (may)
- Manual judgment: **Unknown** (not inspected).

---

## 3) Causality: what changed vs “real reasoning collapse”

Based on code, the causal chain is:

1) **Heuristic-only evaluation dominates** (last-24h is heavily heuristic, with bucketed quality).
2) The heuristic is calibrated as a strict gate: **any issue → needs_improvement**.
3) The most common “issues” are **hygiene/process** (schema/query errors, finish guard blocks, broad commits, injected-signal unavailable).
4) Therefore `evaluator.low-quality-rate-24h` becomes a proxy for “hygiene friction incidence,” not for “task outcome quality.”

This supports your belief: the breach is driven more by **rubric/heuristic strictness + evaluation mode drift** than by a sudden system-wide reasoning collapse.

---

## 4) Fix options (2–3) with expected metric impact

### Option A — Rubric/metric definition change (separate hygiene from outcome quality)

**Idea:** Change `evaluator.low-quality-rate-24h` (or its upstream scoring) so that *minor process hygiene* issues do not count as “low quality” for this metric.

Concrete approaches:
- **A1: split metrics**
  - Keep the current heuristic issues, but define a separate metric like `evaluator.hygiene-friction-rate-24h` counting sessions with issues in a hygiene allowlist.
  - Modify `evaluator.low-quality-rate-24h` to count only:
    - terminal failures (status error/interrupted excluding clean-start)
    - “review override: needs_improvement”
    - or issues in a stricter “outcome failure” list

**Expected impact:** High. If (as evidence suggests) most NI are hygiene-only, excluding them could drop the rate substantially (potentially from ~0.39 to nearer the hv=NULL baseline).

**Risk:** Could mask real problems if hygiene correlates with deeper failures. Mitigation: keep hygiene as a separate, monitored metric.

### Option B — Heuristic tuning (reduce false-positive/over-triggering)

**Idea:** Keep heuristic-based quality metric, but tune `classifyVerdict()` so that hygiene issues don’t automatically force NI.

Concrete tuning candidates:
- **B1: downgrade certain issues to “warnings” (no verdict flip)**
  - e.g., treat `schema/query error in transcript` as a warning **if** the transcript later shows recovery (schema inspection + corrected query), or if the session ends `status='done'`.
- **B2: require multiple independent signals before NI=0.55**
  - e.g., require ≥2 issues, or one issue + low opCount, before flipping to NI.
- **B3: special-case Clean start (fresh)**
  - if `status='interrupted'` but `error='Clean start (fresh)'`, do not force 0.2/NI.

**Expected impact:** Medium to high depending on prevalence. Clean-start special-casing alone could reduce the 0.2 bucket but the breach seems dominated by 0.55; the biggest win is relaxing “any single issue → NI.”

**Risk:** Might over-credit sessions that are sloppy but still finish. Mitigation: add a separate hygiene signal/metric (Option A hybrid).

### Option C — Workflow/system fixes upstream (reduce incidence of flagged hygiene)

**Idea:** Reduce the inputs that trigger heuristic issues, without changing scoring.

Targets:
- **C1: uncommitted-changes guard friction**
  - Encourage/check `git status --short` early in workflows; ensure runtime-generated files are ignored or auto-cleaned.
  - Consider making `finish()` guard auto-suggest the exact `git add`/`git restore` needed (may already exists; if not, add).
- **C2: schema/query errors**
  - Provide canonical query snippets and “schema first” templates in shared docs.
  - Add a lightweight helper in `query_db` usage docs: always `PRAGMA table_info(table)` first for non-trivial tables.

**Expected impact:** Medium, but slower. It reduces numerator (hygiene issues) by behavioral change rather than scoring changes.

**Risk:** Requires broad behavior changes across agents; likely slower than rubric/heuristic tweak.

---

## 5) Recommended next step to close the loop

1) Decide policy: **Should hygiene/process issues count as “low quality” for `evaluator.low-quality-rate-24h`?**
   - If *no*: pursue Option A (split metrics) + minor heuristic changes.
   - If *yes*: pursue Option C (workflow hygiene improvements) and accept metric meaning.

2) Operationally: align versions
   - `session-aftermath-scan.ts` default hv is still 2; `evaluator-aftermath.ts` currently writes hv=3. Decide and align to avoid mixed-version churn.

---

## Appendix: Key code excerpts (for reviewers)

- `agents/evaluator/workflows/evaluator-aftermath.ts`:
  - `HEURISTIC_VERSION = 3`
  - `transcriptIssues()` includes:
    - `finish() blocked [uncommitted changes]` → issue
    - `/no such column|table/` → issue
  - `classifyVerdict()` maps:
    - failed → quality 0.2, NI
    - else issues → quality 0.55, NI
    - else → quality 0.85, good
