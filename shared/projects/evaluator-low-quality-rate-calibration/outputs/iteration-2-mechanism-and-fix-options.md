# Iteration 2 — Mechanism + Fix Options (heuristic v2)

## 1) Where heuristic v2 is implemented + the specific rules behind the top issues

### 1.1 Primary heuristic scorer (workflow)
**File:** `agents/evaluator/workflows/evaluator-aftermath.ts`

Key points (directly from code):

- **Heuristic version constant**
  - `export const HEURISTIC_VERSION = 3;`

- **Step-function verdict mapping (causal mechanism for “quality=0.55 → needs_improvement”)**
  - Implemented in `classifyVerdict(session, transcript)`:
    - `failed = status in {error, interrupted} OR !!session.error`
    - `quality = failed ? 0.2 : (issues.length ? 0.55 : 0.85)`
    - `verdict = failed || issues.length ? "needs_improvement" : "good"`

  This means **any single issue**, even purely “hygiene/process”, deterministically forces:
  - `quality = 0.55`
  - `verdict = needs_improvement`

### 1.2 The top issue strings and their detectors
All of these live in `agents/evaluator/workflows/evaluator-aftermath.ts` → `transcriptIssues(transcript)` (and a couple in `classifyVerdict`).

#### A) “finish blocked by uncommitted changes”
**Rule:**
```ts
if (ownText.includes("finish() blocked [uncommitted changes]")) {
  issues.push("finish blocked by uncommitted changes");
}
```
**Mechanism:** if the transcript contains the literal guard string, it is an issue ⇒ `quality=0.55` (unless terminal failure forces 0.2).

#### B) “schema/query error in transcript”
**Rule:**
```ts
if (/no such column:/i.test(ownText) || /no such table:/i.test(ownText)) {
  issues.push("schema/query error in transcript");
}
```
**Mechanism:** any occurrence of SQLite error strings in the transcript text triggers issue ⇒ `quality=0.55`.

Potential brittleness/false-positive sources:
- It does **not** currently check that the error came from `query_db` specifically; it’s plain regex over assistant-owned transcript text.
- It will also match e.g. quoted logs/examples.

#### C) “interrupted / clean start (fresh)”
This is not a single named issue; it arrives via `classifyVerdict()` from session fields:

**Rules:**
```ts
if (status === "error" || status === "interrupted") issues.push(`terminal status: ${status}`);
if (session?.error) issues.push(`error: ${String(session.error).slice(0, 240)}`);

const failed = status === "error" || status === "interrupted" || !!session?.error;
quality: failed ? 0.2 : ...
verdict: failed || issues.length ? "needs_improvement" : "good"
```
So if a session ends `interrupted` with `error="Clean start (fresh)"`, it will deterministically land at:
- `quality=0.2`
- `verdict=needs_improvement`

### 1.3 Where heuristicVersion=2 comes from (rollout / persistence mechanism)
**File:** `agents/may/handlers/session-aftermath-scan.ts`

This is a cron fallback (“7-minute fallback for evaluator aftermath”) that backfills sessions missing evaluations.

Key points:
- `const DEFAULT_HEURISTIC_VERSION = 2;`
- It selects candidate sessions where evaluation is missing **OR** where the existing evaluation is `good` and has a heuristicVersion below the configured threshold:

```sql
AND (
  e.sessionId IS NULL
  OR (
    e.verdict = 'good'
    AND COALESCE(CAST(json_extract(e.overall, '$.heuristicVersion') AS INTEGER), 0) < ?
  )
)
```

Implications:
- **Needs-improvement evals are not refreshed** by this fallback scanner (only `good` ones). If `heuristicVersion=2` NI evals were written at any point, they can persist.
- There is **version drift**: the workflow scorer advertises `HEURISTIC_VERSION=3` but the fallback scan defaults to `heuristicVersion=2` when deciding whether to refresh “good” evals.

## 2) Stratified manual audit (~20 sessions)

Important limitation (data access): there is no `transcripts` table in the runtime DB (confirmed by query error). In this iteration, the audit uses:
- `sessions` fields (`status`, `error`, `opCount`)
- `session_digests.what_happened` (when present)

Because the dominant v2 NI mechanism is “*any* issue ⇒ NI”, the audit classification is:
- **Hygiene/process-only NI**: the digest describes a reasonable outcome, but the evaluation is still NI likely due to a hygiene trigger (artifact-gate, uncommitted-changes, shallow gate, etc.)
- **Substantive low-quality**: terminal interruption/error, or digest indicates real failure to accomplish the task.

### 2.1 Sample A — hv=2 AND verdict=needs_improvement (10)
1. `s_1778262140393_13` (may) — **Hygiene/process-only (likely shallow/session-meta trigger).** Digest: “Audited 3 open metric alerts … no intervention needed.” Looks like valid work; NI likely from a heuristic issue unrelated to task quality.
2. `s_1778261673918_5` (scout) — **Hygiene/process-only.** Digest indicates triage completed; NI likely from artifact-gate / heuristic hygiene flags.
3. `s_1778261317514_9` (dev) — **Substantive failure (unscorable).** `status=interrupted`, `error="Clean start (fresh)"` ⇒ forced `quality=0.2`.
4. `s_1778261255980_7` (may) — **Substantive failure (unscorable).** `status=interrupted`, `error="Clean start (fresh)"`.
5. `s_1778261139993_1` (arc) — **Hygiene/process-only.** Digest: refuses to write due to “iter-02 terminally closed” policy; may be correct behavior but heuristic NI is not “reasoning collapse.”
6. `s_1778261191049_4` (scout) — **Hygiene/process-only / task-mismatch.** Digest claims a report but unclear; without transcript hard to verify, but doesn’t look like a system-wide reasoning failure.
7. `s_1778261147546_2` (scout) — **Hygiene/process-only.** Digest: investigated metrics; suggests repeated failures caused by artifact gate.
8. `s_1778261139968_0` (may) — **Hygiene/process-only.** Digest: observation-only pass; NI likely from an issue trigger (e.g., “metric health claim without live evidence” or shallow).
9. `s_1778260995450_10` (scout) — **Hygiene/process-only.** Digest: wrote heartbeat log to satisfy artifact gate and committed; seems operationally fine.
10. `s_1778260937494_9` (scout) — **Hygiene/process-only.** Digest is a plan/triage narrative; NI likely from shallow/guard triggers.

**Tally (best-effort with available evidence):** 8 hygiene-only vs 2 substantive/unscorable.

### 2.2 Sample B — hv=NULL AND verdict=needs_improvement (5)
1. `s_1778211956403_3` (dev) — **Hygiene/process-only.** Digest: heartbeat triage completed; NI likely triggered by hygiene rules (same step-function).
2. `s_1778211943135_2` (may) — **Hygiene/process-only.** Digest: alert audit + message sent; seems fine.
3. `s_1778211629857_6` (dev) — **Hygiene/process-only.** Digest: committed work + resolved dirty state.
4. `s_1778211532870_3` (may) — **Hygiene/process-only.** Digest: deep health analysis + artifact; looks successful.
5. `s_1778211482795_0` (may) — **Hygiene/process-only.** Digest: “No action needed.”

**Tally:** 5 hygiene-only vs 0 substantive.

### 2.3 Sample C — hv=2 AND verdict=good (5)
(These are “controls”: hv2 can score good when no issues trigger.)

1. `s_1778260767342_3` (scout) — **Good/OK.** Digest simply “done”; no evidence of failure.
2. `s_1778259480085_9` (may) — **Good/OK.** Digest: verified system health.
3. `s_1778258840512_6` (dev) — **Good/OK.** Digest: heartbeat triage; committed changes.
4. `s_1778258867886_8` (arc) — **Good/OK.** Digest: refused extra work due to terminal closure; but landed good here (suggesting no heuristic issue trigger fired).
5. `s_1778258726969_1` (may) — **Good/OK.** Digest: audited alerts/delivery failures.

## 3) Fix options (interventions) + expected metric impact

### Option 1 — Rubric/metric change: split “substantive low quality” vs “operational hygiene/unscorable”
**Change:** redefine `evaluator.low-quality-rate-24h` to exclude sessions whose NI reasons are purely:
- terminal interruptions / clean-start (`status in {interrupted,error}` or `session.error` present)
- transcript parse/schema errors that indicate tooling failure rather than reasoning
- “finish blocked by uncommitted changes” (guard hygiene)

…and track them in separate metrics:
- `evaluator.unscorable-rate-24h`
- `evaluator.hygiene-failure-rate-24h`

**Expected impact:** large immediate drop in the breached metric, because the dominant NI mass is hygiene/unscorable. Based on the sample A above (~80% hygiene-only), the substantive NI rate is plausibly well below the 0.30 threshold.

Risk/intent check: this changes what the metric means (from “overall operational quality” to “reasoning/task quality”). If the original intent was operational reliability, this may be misaligned.

### Option 2 — Heuristic tuning: de-step-function “any issue ⇒ needs_improvement”
**Change:** in `classifyVerdict()` replace the step-function with weighted scoring or a two-tier verdict:
- Keep terminal failures as NI at 0.2.
- For hygiene issues (uncommitted changes, schema/query regex, missing live evidence) apply a smaller penalty that can still land in `verdict=good` or a new `verdict=warning`.

Example tuning rule:
- If only hygiene issues present and `status=done`, set `quality=0.7` and `verdict=good` but record issues.
- Require *two* independent hygiene signals before downgrading to NI.

**Expected impact:** should reduce NI-rate substantially, especially the “quality=0.55” pile, while preserving visibility of hygiene problems.

Risk: could create false-good if hygiene issues correlate with genuine low-quality work; mitigated by continuing to track hygiene issue rate separately.

### Option 3 — Workflow fix: reduce incidence of the hygiene triggers
Targets:
- **Uncommitted changes guard:** enforce a pre-finish “git status clean” step in workflows that write files; improve docs; auto-add `git diff --name-only` evidence on block.
- **Interrupted/clean-start:** investigate runner stability; treat “Clean start (fresh)” as “unscorable” (do not count against low-quality) rather than NI.
- **Schema/query error regex:** encourage `PRAGMA table_info` before complex queries; add an evaluator hint that schema errors are often recoverable and should trigger a retry.

**Expected impact:** slower but principled reduction in the same NI buckets; improves real operational quality.

## 4) Recommendation (next action)
Pick one of these policy decisions explicitly:
1) If the alert is intended to measure *reasoning/task quality*, implement Option 1 (split metric) + Option 2 (tune heuristic so hygiene doesn’t auto-NI), then add a separate hygiene metric.
2) If the alert is intended to measure *operational correctness*, keep metric but implement Option 3 aggressively and potentially lower the penalty for “single hygiene issue”.

Either way, fix the **version drift** in `session-aftermath-scan.ts` by aligning `DEFAULT_HEURISTIC_VERSION` with `HEURISTIC_VERSION` (currently 2 vs 3), and decide whether NI evals should ever be refreshed when heuristic rules change.
