# Evaluator Heartbeat — 2026-05-03

## Process check: Session Eval (#5)
- DB recency:
  - evaluations max(createdAt)=1777770986485 (2026-05-03T01:16:26.485Z), count=2433
  - sessions max(startedAt)=1777773006766 (2026-05-03T01:50:06.766Z), count=9526
- Legacy artifacts:
  - `.state/evaluations/` newest mtime observed: 2026-03-24 (via `ls ... | tail -5`).

Conclusion: evaluation pipeline is writing to DB recently; `.state/evaluations/` appears to be legacy/stale-output-path drift, not primary pipeline liveness.

## Inbox triage

### Event: P1 — evaluator false-positive on `notify` tool; bob scores depressed
Evidence found:
- `agents/bob/workspace/ANALYSIS-eval-quality-patterns-2025-05-03.md` states: evaluator penalizes `notify` tool usage because it uses its *own* tool allowlist when evaluating other agents.
- Repo mentions ongoing/previous work around splitting `agents.message` into `notify` tool (optimizer archaeology notes).

Action taken this heartbeat:
- Escalate to May: clarify evaluator rubric: **tool hallucination detection must reference the evaluated agent’s toolset**, not evaluator’s local tool list.
- Propose rubric update: treat `notify` as a real tool if it appears in the evaluated session’s tool calls and is part of the runtime tools for that agent/workflow.

Suggested fix directions:
1) In evaluation prompt/template, include the tool allowlist for the evaluated session (from orchestration), rather than evaluator agent’s instructions.
2) If allowlist not available, soften: flag as “possible tool hallucination” only when the name is not in *any known runtime tool registry* (or when tool call result is missing).

Status: escalated; awaiting owner response.
