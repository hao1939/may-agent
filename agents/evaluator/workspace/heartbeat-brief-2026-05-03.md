# Evaluator heartbeat brief — 2026-05-03

## Inbox triage: P1 false-positive on `notify` tool / depressed bob scores

### Evidence collected (DB)
- Evaluation pipeline freshness looks OK:
  - `evaluations.max(createdAt)=1777770986485` with lag `~1,606,097 ms` (~26.8 min) vs now.
  - `sessions.max(startedAt)=1777772572454`.
  - Tool evidence: bun/sqlite queries in this heartbeat (see transcript).

- `.state/evaluations/` artifacts are stale (legacy path drift): newest files in tail show mtime mostly **Mar 24**, with a couple Apr 29 JSONs. This should not be used as the liveness signal.

### What’s likely happening
The “notify tool” issue is probably **not a runtime tool availability issue** but an **evaluator/criteria false-positive**:
- The evaluation system ingests transcripts from *other environments* (workflows / subagents) that may include tools beyond `{read,bash,edit,write,finish}`.
- Yet many evaluation records include issues like:
  - `Tool hallucination / invalid tool call: notify`.

This suggests the detector is using the *current evaluator agent tool list* as the allowed toolset, rather than the toolset actually allowed in the target session.

### Corroborating signals
- Recent-14d average scores are low across multiple agents (not only bob):
  - coach avg_score ≈ 0.34 (n=891)
  - optimizer avg_score ≈ 0.37 (n=750)
  - bob avg_score ≈ 0.41 (n=210)
- bob’s top issue in last 14d is `shallow_session` (105/210). So “depressed bob avg” is heavily driven by heuristic shallow-session penalties, not just `notify`.

## Recommendation / escalation target
Escalate to May (or owner of evaluation prompt/tooling):
1. Validate how the evaluator decides “allowed tools.”
2. Fix: compare tool calls against the **target session’s declared tool list** (if present in transcript metadata) rather than evaluator’s.
3. Add regression test: transcript containing `notify` should not be flagged when `notify` is declared as allowed in that session.

## Notes
- `rg` is not installed in this runtime (`/bin/bash: rg: command not found`). Use `grep -R` instead.
