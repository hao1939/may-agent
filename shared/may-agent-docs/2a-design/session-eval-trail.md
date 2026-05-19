# Design: Session Evaluation Trail

**Status**: Draft  
**Date**: 2026-05-16  
**Aligned with**: `sessions.md`, `webui.md`, `runtime.md`, `sdk.md`

## Purpose

Session evaluation is one pipeline with two views of the same judgment:

- session-level summary for querying, metrics, and overview cards
- turn/line-level evidence for investigation and human correction

The raw `session.jsonl` remains the source of truth. The evaluator writes an append-only sibling trail:

```text
.state/sessions/<id>/session.eval.jsonl
.state/sessions/history/<id>/session.eval.jsonl
```

The `evaluations` database table is a projection/index of the latest session-level summary. It is not the only source of evaluation truth.

## Row Model

`session.eval.jsonl` is append-only. Each row has `sessionId`, `source`, `author`, and `createdAt`. Evaluation rows are evidence, not commands; owner-routed findings name who should decide the fix.

Session summary row:

```json
{
  "type": "summary",
  "schemaVersion": 1,
  "sessionId": "s_...",
  "source": "evaluator-heuristic",
  "author": "evaluator",
  "createdAt": 1770000000000,
  "transcriptSource": ".state/sessions/history/s_.../session.jsonl",
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
        "suggestedActions": ["rerun narrow repair", "update agent guidance if repeated"]
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
  "rawSource": ".state/sessions/history/s_.../session.jsonl",
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
    "source": ".state/sessions/history/s_.../session.jsonl",
    "line": 12,
    "raw": "{...}"
  }
}
```

A later evaluator pass appends new rows instead of rewriting old rows. That preserves the original evaluator judgment, human correction, revised judgment, and raw context for future evaluator training.

## Pipeline

`evaluator-aftermath` owns generation:

1. Read `session.jsonl`.
2. Classify the session and write/update the `evaluations` table as the summary projection.
3. Append a `type: "summary"` row to `session.eval.jsonl`.
4. Append `type: "line"` rows for important raw log lines.
5. Add owner findings to the summary when critique is actionable. Owners are concrete responsibility labels: `agent:<name>` or `human:<role>`.
6. Emit `learning.feedback` only for high-severity or blocked/waiting findings; keep routine findings in the eval trail for digest/review. The event `owner` is the responsible owner: `agent:<name>` or `human:<role>`. Human-owned findings are delivered to May by the human-owner routing rule, so May can decide whether to ask the human via Telegram/UI, rewrite context, defer, or dismiss.
7. If a deeper evaluator review runs, it may append additional summary or line rows with a different `source`.

The Web UI and HTTP server do not own evaluation semantics. They may provide convenience endpoints to read the eval trail, append human feedback, or dispatch evaluator work, but scoring belongs to the evaluator pipeline.

## Convenience API

The UI uses:

```http
GET /api/sessions/:id/eval
POST /api/sessions/:id/eval
POST /api/sessions/:id/eval/comment
```

`POST /api/sessions/:id/eval` is a convenience dispatcher. With an empty body, it asks evaluator to generate/review the whole session trail. With `{ "line": 12 }`, it asks evaluator to focus on that raw line and related feedback. There is no separate mode. The API does not decide repairs; it only dispatches evaluator work and records feedback.

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

## Open Questions

- How much line-level heuristic seeding is useful before it becomes noise.
- Whether deeper LLM review should annotate every turn or only important/controversial turns.
- How to compact long raw records while preserving enough evidence for training evaluator agents.
- How to tune `learning.feedback` volume so actionable items reach owners without turning every eval row into a notification.
