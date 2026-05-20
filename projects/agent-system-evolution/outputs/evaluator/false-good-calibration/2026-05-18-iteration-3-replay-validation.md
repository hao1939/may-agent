# Iteration 3 replay validation — real transcript reclassification

## Goal
Validate the iteration-2 hardening against representative real transcripts from the iteration-1 false-good audit, not just synthetic unit tests.

## Method
Replayed real `session.jsonl` transcripts through the current code in `agents/evaluator/workflows/evaluator-aftermath.ts` using Bun imports of:
- `transcriptOutputSignals()`
- `classifyEvaluationLane()`

Replay shape:
```bash
cd /app && bun -e '
import { readFileSync } from "node:fs";
import { transcriptOutputSignals, classifyEvaluationLane } from "./agents/evaluator/workflows/evaluator-aftermath.ts";
const sessions = [
  { sessionId: "s_1779066050617_1", agent: "may", status: "done", opCount: 9, projectId: null, workflowRunId: "wr_1779066050586_2uh8", error: null },
  { sessionId: "s_1779064237055_0", agent: "may", status: "done", opCount: 4, projectId: null, workflowRunId: "wr_1779064237034_j3xo", error: null },
  { sessionId: "s_1779053381283_494", agent: "dev", status: "done", opCount: 9, projectId: null, workflowRunId: "wr_1779053381270_glu2", error: null },
  { sessionId: "s_1779051581305_487", agent: "arc", status: "done", opCount: 5, projectId: null, workflowRunId: "wr_1779051581292_13uh", error: null },
  { sessionId: "s_1779082705174_76", agent: "scout", status: "done", opCount: 10, projectId: null, workflowRunId: "wr_1779082705164_0xih", error: null },
];
for (const session of sessions) {
  const transcript = readFileSync(`.state/sessions/history/${session.sessionId}/session.jsonl`, "utf8");
  console.log(JSON.stringify({
    sessionId: session.sessionId,
    signals: transcriptOutputSignals(session, transcript),
    route: classifyEvaluationLane(session, transcript),
  }, null, 2));
}
'
```

## Representative contaminated sessions from the iteration-1 audit

### 1) `s_1779066050617_1` (`may`)
**Old contamination pattern**
- Audit finding: false-good route claimed `project artifact, knowledge update`, but the aftermath review said the session produced neither.
- Real transcript evidence: `git status --short` output contained ambient dirty paths including both `agents/evaluator/knowledge/criteria.md` and multiple `projects/...` entries, even though the session made no `write`/`edit`/`message` call.

**Current-code replay output**
```json
{
  "sessionId": "s_1779066050617_1",
  "signals": ["verification command", "workflow-linked session"],
  "route": {
    "lane": "routine_ok",
    "reason": "good session; no material output signal (verification command, workflow-linked session)",
    "signals": ["verification command", "workflow-linked session"]
  }
}
```

**Result**
- `project artifact`: no longer emitted
- `knowledge update`: no longer emitted
- lane moved from false-good-prone material-output routing to `routine_ok`

### 2) `s_1779064237055_0` (`may`)
**Old contamination pattern**
- Audit finding: aftermath explicitly called the route's `project artifact / knowledge update` signal false; there were no `write`, `edit`, or `message` calls.
- Real transcript evidence: `git status --short` output again listed ambient dirty `agents/evaluator/knowledge/criteria.md` plus several `projects/...` paths.

**Current-code replay output**
```json
{
  "sessionId": "s_1779064237055_0",
  "signals": ["verification command", "workflow-linked session"],
  "route": {
    "lane": "routine_ok",
    "reason": "good session; no material output signal (verification command, workflow-linked session)",
    "signals": ["verification command", "workflow-linked session"]
  }
}
```

**Result**
- ambient dirty-path text no longer creates material-output signals
- session now routes as `routine_ok`

### 3) `s_1779053381283_494` (`dev`)
**Old contamination pattern**
- Audit finding: aftermath said there was “no actual project artifact or knowledge update”; the session was disciplined low-signal triage.
- Real transcript evidence: `git status --short` output listed unrelated dirty `agents/evaluator/knowledge/criteria.md`, `agents/scout/workspace/digest/today.md`, and multiple `projects/...` / `shared/...` paths.

**Current-code replay output**
```json
{
  "sessionId": "s_1779053381283_494",
  "signals": ["verification command", "workflow-linked session"],
  "route": {
    "lane": "routine_ok",
    "reason": "good session; no material output signal (verification command, workflow-linked session)",
    "signals": ["verification command", "workflow-linked session"]
  }
}
```

**Result**
- no `project artifact`
- no `knowledge update`
- no success-candidate promotion from ambient repo dirt

### 4) `s_1779051581305_487` (`arc`)
**Old contamination pattern**
- Audit finding: aftermath said the only visible output was runtime-managed `agents/arc/last-session.md`, not a durable artifact, and the route claim of project/material output was false.
- Real transcript evidence: arc's end-of-session `git -C /app/agents status --short` output still surfaced unrelated dirty evaluator/scout/project paths, which previously polluted transcript text matching.

**Current-code replay output**
```json
{
  "sessionId": "s_1779051581305_487",
  "signals": ["verification command", "workflow-linked session"],
  "route": {
    "lane": "routine_ok",
    "reason": "good session; no material output signal (verification command, workflow-linked session)",
    "signals": ["verification command", "workflow-linked session"]
  }
}
```

**Result**
- unrelated dirty paths and runtime-adjacent noise no longer create material-output routing
- session now stays in `routine_ok`

## Positive controls

### Positive control A — legitimate knowledge write still routes as material output
Session: `s_1773429903935_1211` (historical transcript archive still available under `.state/sessions/history/`)

**Real write/edit evidence in transcript**
- `write("agents/shared/knowledge/mast-taxonomy.md", ...)`
- `edit("agents/evaluator/knowledge/criteria.md", ...)`
- additional evaluator knowledge edits in the same session

**Current-code replay output**
```json
{
  "signals": ["file write/edit", "knowledge update", "verification command"],
  "route": {
    "lane": "success_candidate",
    "reason": "good session with material output: file write/edit, knowledge update",
    "signals": ["file write/edit", "knowledge update", "verification command"]
  }
}
```

**Result**
- actual assistant file mutations under `agents/.../knowledge/` still produce `knowledge update`
- the hardening removed transcript-text contamination without breaking true-positive knowledge routing

### Positive control B — legitimate project artifact still routes as material output
Session: `s_1779098046289_8`

**Real write evidence in transcript**
- `write("projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-1-false-good-audit.md", ...)`
- session also included a real commit

**Current-code replay output**
```json
{
  "sessionId": "s_1779098046289_8",
  "signals": ["file write/edit", "git commit", "project artifact", "verification command"],
  "route": {
    "lane": "success_candidate",
    "reason": "good session with material output: file write/edit, git commit, project artifact",
    "signals": ["file write/edit", "git commit", "project artifact", "verification command"]
  }
}
```

**Result**
- actual assistant writes under `projects/.../outputs/...` still produce `project artifact`
- the hardening preserved true-positive project-artifact routing

## Negative/positive contrast for the audited mechanism

| Session | Prior false-good mechanism | Current signals | Current lane |
|---|---|---|---|
| `s_1779066050617_1` | `git status --short` text mentioned `agents/.../knowledge/...` and `projects/...` | `verification command`, `workflow-linked session` | `routine_ok` |
| `s_1779064237055_0` | same contamination path from ambient dirty worktree text | `verification command`, `workflow-linked session` | `routine_ok` |
| `s_1779053381283_494` | same contamination path from ambient dirty worktree text | `verification command`, `workflow-linked session` | `routine_ok` |
| `s_1779051581305_487` | ambient dirt + runtime-adjacent artifact confusion | `verification command`, `workflow-linked session` | `routine_ok` |
| `s_1773429903935_1211` | true knowledge write | `file write/edit`, `knowledge update`, `verification command` | `success_candidate` |
| `s_1779098046289_8` | true project output write | `file write/edit`, `git commit`, `project artifact`, `verification command` | `success_candidate` |

## Current 24h baseline for post-merge comparison
Queried from `events.timestamp`:

```sql
SELECT event_type, COUNT(*) AS count
FROM events
WHERE event_type IN ('evaluation.false_good','evaluation.reviewed','evaluation.success_candidate')
  AND timestamp >= (CAST(strftime('%s','now') AS INTEGER) - 86400) * 1000
GROUP BY event_type
ORDER BY event_type;
```

Results at replay time:
- `evaluation.false_good`: **52**
- `evaluation.reviewed`: **133**
- `evaluation.success_candidate`: **114**

Derived sample rate for context:
- false-good / reviewed-good sample ≈ **39.1%** (`52 / 133`)

## Conclusion
The replay validates the intended hardening on real audited transcripts:
- representative contaminated heartbeats that previously picked up `project artifact` and/or `knowledge update` from `git status --short` text now emit only non-material signals and route to `routine_ok`
- legitimate assistant writes to `agents/.../knowledge/...` and `projects/...` still route to `success_candidate`

This closes the main uncertainty left after iteration 2: the fix is not only unit-test strong, it also reclassifies representative real-world false-good sessions from the audit in the expected direction.