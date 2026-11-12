# Design: Session Evaluation Trail

**Supports:** [System Model](system-model.md#improve-from-evidence-and-make-problems-actionable). Retains inspectable assessment evidence and its limits for later feedback and calibration.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#simple-first).

**Design status:** Accepted.
**Implementation status:** Summary evaluation and its SQLite projection, exact
session reads and read-only historical trail reads are supported. HTTP generation
and human-feedback writes are retired. The legacy Learning dashboard is retired
in [Host PR 457](https://github.com/hao1939/may-agent/pull/457), merged as
`a84c6918ed40`. Installed adoption is unverified; see the [retirement record](../archive/reviews/learning-dashboard-retirement-20261112.md).
The row formats below describe retained evidence, not an available HTTP annotation
writer. App-owned review and calibration remain separate from this history view.
**Aligned with:** [Sessions](sessions.md), [Web UI](webui.md),
[Runtime](runtime.md), [SDK](sdk.md).

## Purpose

Retained session annotations provide summary and line views of a judgment.
This is separate from Alex's current
primary [Task-outcome review](../evaluation/task-outcome-evaluation.md):

- session-level summary for querying, metrics, and overview cards
- turn/line-level evidence for investigation and human correction

The raw `session.jsonl` remains execution evidence, not Task acceptance. The
historical annotations remain readable in their append-only sibling trail:

```text
.state/sessions/<id>/session.eval.jsonl
```

The `evaluations` database table is a projection/index of the latest session-level summary. It is not the only source of evaluation truth.

## Row Model

`session.eval.jsonl` is append-only. Each row has `sessionId`, `source`, `author`, and `createdAt`. Evaluation rows are evidence, not commands; owner-routed findings name who should decide the fix.

Illustrative retained session summary row (the owning App schema governs emitted fields):

```json
{
  "type": "summary",
  "schemaVersion": 1,
  "sessionId": "s_...",
  "source": "evaluator-heuristic",
  "author": "evaluator",
  "createdAt": 1770000000000,
  "transcriptSource": ".state/sessions/s_.../session.jsonl",
  "verdict": "needs_improvement",
  "quality": 0.55,
  "efficiency": 0.8,
  "issues": ["schema/query error in transcript"],
  "lane": "needs_triage",
  "targetBreakdown": {
    "request": "ok",
    "execution": "check",
    "result": "issue",
    "verification": "unknown"
  },
  "repairDecision": {
    "ownerChoosesAction": true,
    "ownerFindings": [
      {
        "id": "execution-quality",
        "scope": "agent_behavior",
        "owner": "agent:dev",
        "severity": "medium",
        "finding": "Execution/result quality needs owner review.",
        "suggestedActions": [
          "rerun narrow repair",
          "update agent guidance if repeated"
        ]
      }
    ],
    "notificationDecision": {
      "policy": "persist_all_notify_actionable",
      "notifyNow": false
    }
  },
  "comment": "Session needs_improvement: schema/query error in transcript"
}
```

Line-level row:

```json
{
  "type": "line",
  "schemaVersion": 1,
  "sessionId": "s_...",
  "line": 12,
  "source": "evaluator-heuristic",
  "author": "evaluator",
  "createdAt": 1770000000000,
  "rawSource": ".state/sessions/s_.../session.jsonl",
  "rawRole": "toolResult",
  "score": "issue",
  "issues": ["tool_output_error"],
  "purpose": "tool_output",
  "comment": "Tool output indicates failure or invalid assumption: no such file"
}
```

Human feedback is stored in the same trail:

```json
{
  "type": "line",
  "sessionId": "s_...",
  "line": 12,
  "source": "human-feedback",
  "author": "hao",
  "createdAt": 1770000001000,
  "comment": "This was not wasteful; the prior output was from generated UI, not tracked source.",
  "rawContext": {
    "source": ".state/sessions/s_.../session.jsonl",
    "line": 12,
    "raw": "{...}"
  }
}
```

A later evaluator pass appends new rows instead of rewriting old rows. That preserves the original evaluator judgment, human correction, revised judgment, and raw context for future evaluator training.

## Write boundary

The owning App reads session evidence, judges it and emits
`evaluation.recorded`. The Host projection validates that fact and writes the
bounded evaluations summary. Trail generation separately appends artifact
annotations through the granted execution/file boundary. App code does not write
the Host database directly.

Reviewed findings use explicit App routes. An owner label attributes a finding;
it cannot route human work by itself. A required human decision belongs to an
exact Condition or a typed May request. The full routing and learning policy
lives in [Practice Learning Loop](practice-learning-loop.md).

The trail preserves append-only summary and line annotations, including later
reviews and human feedback. HTTP and Web UI expose those records; they do not
own scoring or turn raw detector output into accepted learning.

## Read API

The UI uses:

```http
GET /api/sessions/:id/eval
```

This reads saved rows without generating a review or changing evidence. A session
without saved notes returns `exists: false` and an empty row list. The retired
POST generation/comment routes return 404. New review work uses the owning App's
ordinary Task input; the history viewer does not promise a line-annotation writer.

## UI Model

The session page is an enriched chat window. Evaluation evidence appears beside the turn it refers to:

```text
┌───────────────────────────────┬───────────────────────────────┐
│ Turn 1: user/assistant/tools   │ Eval rows for lines 1..N       │
│ raw links: session.jsonl:1     │ human feedback + evaluator     │
├───────────────────────────────┼───────────────────────────────┤
│ Turn 2                         │ Eval rows for turn 2           │
└───────────────────────────────┴───────────────────────────────┘
```

The human should not mentally match a separate evaluation rail to the transcript. When scrolling to a turn, the relevant evaluation evidence should be visible beside it.

## Interpretation And Calibration

The heuristic summary is a fast, versioned routing judgment, not ground truth.
Terminal status, tool failures, material-output signals, and verification
evidence can affect its verdict. Non-routine lanes receive a separate evaluator
review, which may override the stored verdict and records its own artifact and
session evidence.

Consumers should therefore:

- read `heuristicVersion`, lane, issues, and review evidence with the verdict;
- separate execution failures from substantive output-quality findings;
- compare metrics only across compatible evaluator/heuristic versions; and
- use human feedback and reviewed verdicts as correction evidence rather than
  rewriting prior rows.

Dated calibration findings and samples belong in the Evaluation app's
criteria/calibration records, not in this stable Host contract.

## Remaining Questions

- How much line-level heuristic seeding is useful before it becomes noise.
- Whether deeper LLM review should annotate every turn or only important/controversial turns.
- How to compact long raw records while preserving enough evidence for training evaluator agents.
- How to tune `learning.feedback` volume so actionable items reach owners without turning every eval row into a notification.
