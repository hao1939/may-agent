# Design: Journal-busywork detection for `computeHeuristicScores`

## Goal
Reduce false “good” ratings for sessions that only do busywork (write/verify journal entries) yet currently receive `quality=4` due to the `finish(success) + deliverables (+ evidence)` path.

We **do not change implementation here**; this document specifies *criteria* and *specific code changes* for Tech Lead/Coder to implement in `src/lib/evaluator.ts` inside `computeHeuristicScores`.

---

## Current behavior (what’s causing the inflation)
In `computeHeuristicScores` (around the section labeled **4. finish() tool usage** and **5b. Semantic quality signals for finish(success)**):

- Base: `quality = 3`.
- If `finishStatus === "success"` and the finish call has both:
  - `verification_evidence.length > 0` and
  - `deliverables.length > 0`

  then the function does:
  - `quality += 1;`
  - `issues.push("finish_success_verified")`
  - `issues.push("has_deliverables")`

This means a “heartbeat” session that:
- writes `journal.md` (deliverable), and
- “verifies” it via `read()` (verification evidence)

…gets promoted from `quality=3` → `quality=4`, which drives the overall verdict toward **good** when efficiency is also high.

---

## Proposed heuristic: `journal_busywork_detected`
Add a **new negative adjustment** that triggers only in the narrow pattern we care about: *sessions whose only meaningful output is journal/todo-style meta writing and verification.*

### Trigger criteria (any ONE of the following signals is enough)
We should mark a session as journal-busywork if **finish status is success** and at least one of these holds:

#### A) Outcome/summary journal-verified phrasing
Detect in `finishParams.summary` (and optionally also the last 1–3 assistant text blocks) phrases that indicate the deliverable is itself a journal entry and the success is “verified/correct”.

**Pattern (case-insensitive):**
- contains `journal` AND one of: `verified`, `correct`, `looks correct`, `all content correct`, `validated`

Suggested regexes:
- `/(?:^|\b)journal(?:\b|[^a-z])/i`
- `/(?:verified|correct|validated|looks good|looks correct|all content correct)/i`

Trigger A if both match in the same text (summary preferred).

Rationale: This targets the observed busywork claims like “Journal entry verified — all content correct”.

#### B) Heartbeat + only journal/todo deliverables
Trigger if the session appears to be a heartbeat *and* deliverables are exclusively meta files.

**Heartbeat detection (choose conservative):**
- `session.task` starts with `heartbeat` OR
- `session.task` contains `[heartbeat]` OR
- `session.task` equals `"Heartbeat"` (case-insensitive)

**Deliverables-only-meta detection:**
All deliverables paths match one of these (case-insensitive, basename match):
- `journal.md`
- `todo.md`
- `notes.md`
- `daily.md`
- `worklog.md`

And **no deliverable** is outside `agents/` (since real product changes usually touch `src/`, `scripts/`, etc.).

Rationale: This catches the common “heartbeat: wrote journal.md” sessions even if they don’t explicitly say “verified/correct” in the summary.

#### C) Deliverables are exclusively journal/todo regardless of heartbeat
Trigger if `finish(success)` and deliverables list is **non-empty** and **all deliverables** are meta files (same list as above), regardless of task name.

Rationale: Some agents may not label the task as heartbeat but still do pure journaling.

---

## Non-trigger / safety conditions (to avoid false positives)
We should *not* downgrade sessions that include journaling **plus** real work.

Add explicit “escape hatches”:

1) If **any deliverable path** looks like real product output, do **not** trigger:
   - starts with `src/` or `scripts/` or `test/` or `tests/`
   - or ends with `.ts`, `.tsx`, `.js`, `.json`, `.sql` (optional)

2) If evidence indicates real verification runs (already detected later via `verified_with_tests`), do **not** trigger.
   - If `issues.includes("verified_with_tests")` then skip busywork penalty.

3) If finish status is not `success`, do nothing (busywork downgrade is only to stop “rubber-stamped success”).

---

## Scoring change
If journal-busywork is detected:

- Clamp quality to **at most 3** (acceptable), rather than subtracting a fixed amount.
  - e.g. `quality = Math.min(quality, 3)`

Why clamp instead of `quality -= 1`?
- These sessions often already got `quality += 1` from finish+deliverables; clamping directly enforces the desired ceiling and is robust against future tweaks to additive scoring.

Also:
- `issues.push("journal_busywork_detected")`
- optionally `issues.push("journal_only_deliverables")` vs `journal_verified_summary` sub-tags for analysis.

---

## Where to change code (specific insertion points)
All changes are within `computeHeuristicScores` in `src/lib/evaluator.ts`.

### 1) Add helper predicates (local functions) near the top of `computeHeuristicScores`
Add small local helpers after `const issues: string[] = [];` (or near other local variables):
- `isJournalMetaPath(path: string): boolean`
- `allDeliverablesAreJournalMeta(deliverables): boolean`
- `hasRealDeliverable(deliverables): boolean`
- `isHeartbeatTask(session.task): boolean`

This keeps regex logic centralized and testable.

### 2) Add the busywork detection block **after** finish(success) scoring but **after** `verified_with_tests` is known
We need `issues.includes("verified_with_tests")` to be computed before we apply the penalty.

Therefore, best placement is **inside** the existing block:

```ts
if (finishParams && finishParams.status === "success") {
  ...
  // existing 5b-* checks including 5b-iv that may push "verified_with_tests"
  ...
  // INSERT: 5b-NEW journal busywork check here (after 5b-iv)
  ...
}
```

Concretely: insert immediately after the `5b-iv` section that computes `verificationRuns` and possibly pushes `"verified_with_tests"`.

### 3) Data used
- `finishParams.summary`
- `finishParams.deliverables` (paths)
- `issues` (for `verified_with_tests` escape hatch)
- `session.task` (heartbeat detection)
- optionally: scan last assistant text blocks from `messages` using the same mechanism already used in proxy-satisfying detection (the “last few assistant messages” extraction code exists later; we can reuse that pattern or keep it summary-only to minimize complexity).

---

## Proposed pseudo-code (drop-in sketch)

```ts
// After verified_with_tests logic, inside: if (finishParams && finishParams.status === "success")
const deliverables = finishParams.deliverables ?? [];
const summary = (finishParams.summary ?? "").toString();

const isHeartbeat = isHeartbeatTask(session.task ?? "");
const hasTests = issues.includes("verified_with_tests");

const journalInSummary = /\bjournal\b/i.test(summary);
const verifiedInSummary = /(verified|correct|validated|all content correct|looks correct)/i.test(summary);

const onlyMeta = deliverables.length > 0 && allDeliverablesAreJournalMeta(deliverables);
const realDeliverable = hasRealDeliverable(deliverables);

const triggerA = journalInSummary && verifiedInSummary;
const triggerB = isHeartbeat && onlyMeta;
const triggerC = onlyMeta;

if (!hasTests && !realDeliverable && (triggerA || triggerB || triggerC)) {
  quality = Math.min(quality, 3);
  issues.push("journal_busywork_detected");
  if (triggerA) issues.push("journal_verified_summary");
  if (onlyMeta) issues.push("journal_only_deliverables");
  if (isHeartbeat) issues.push("heartbeat_journal_busywork");
}
```

Helper suggestions:

```ts
function isJournalMetaPath(p: string): boolean {
  const base = p.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  return ["journal.md","todo.md","notes.md","daily.md","worklog.md"].includes(base);
}

function allDeliverablesAreJournalMeta(delivs: any[]): boolean {
  return delivs.every(d => isJournalMetaPath(d.path ?? d));
}

function hasRealDeliverable(delivs: any[]): boolean {
  return delivs.some(d => {
    const path = (d.path ?? d ?? "").toString();
    return /^(src|scripts|test|tests)\//.test(path) || /\.(ts|tsx|js|json|sql)$/.test(path);
  });
}

function isHeartbeatTask(task: string): boolean {
  return /\bheartbeat\b/i.test(task) || /\[heartbeat\]/i.test(task);
}
```

Note: deliverables appear to be objects like `{ path, description }` in finish params; the helper should accept either strings or objects to be robust.

---

## Expected effect
- Busywork sessions that currently hit `quality=4` due to `finish_success_verified + has_deliverables` will be capped back to `quality=3`.
- Sessions that include *any* real deliverable (e.g., `src/...`) or ran real tests (`verified_with_tests`) will not be penalized.
- Verdict distribution should shift: many heartbeat/journal sessions from “good” → “acceptable”, without impacting legitimate engineering sessions.

---

## Suggested analytics / follow-up
Add the issue tag `journal_busywork_detected` so we can measure:
- how many sessions are downgraded,
- which agents generate most busywork,
- whether false positives occur (e.g., sessions that legitimately produce planning docs).

If false positives appear for legitimate design docs, we can narrow meta filenames or require heartbeat + meta deliverables (use Trigger B only).