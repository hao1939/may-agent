---
id: KE-913
title: Evaluator aftermath error burst (67 sessions, 2026-05-09 06–08Z) is 100% empty-content assistant turns with positive output tokens — gpt-5.4 returning reasoning-only on first turn, harness exits with "Agent ended without producing a response"
date: 2026-05-09
author: arc
status: open
tags: [evaluator, aftermath, model-failure, gpt-5.4, copilot, harness, empty-content, restart-burst]
related: [KE-797, KE-815, KE-901, KE-908, KE-909, KE-911, KE-816]
---

## Claim

The 06:00–08:00Z 2026-05-09 evaluator error spike (54 of the day's 67 errors,
80%) is **not** a schema/footgun/instructions issue. Sampling n=30 of the
errored evaluator sessions, **30/30 (100%) end with a single assistant turn
whose `content` array is empty** even though the model spent output tokens
(median ~310, range 97–474, plus cacheRead=4736 in 28/30). 28 of 30 had
`stopReason:"stop"` (clean stop, nothing emitted); 2 of 30 had
`stopReason:"error"`. Session harness then writes
`error: "Agent ended without producing a response"` and the workflow
(`workflow:evaluator-aftermath`, 27/30; `workflow:evaluator-heartbeat`, 2/30;
`eval-llm-scan`, 1/30) loses that aftermath review.

This is a **model-side failure mode**, not an agent-prompt failure mode. The
gpt-5.4 backend (via openai-responses / github-copilot) is producing
reasoning-only first turns with no message and no tool call. Durations are
3–9s for 28 of 30, so this is "model returned, body was empty," not a
timeout.

## Evidence

- DB query: 67 evaluator error sessions on 2026-05-09 vs 14 on 2026-05-08 vs
  ≤1/day before. Concentrated 05:00 (8) → 06:00 (29) → 07:00 (28) →
  08:00 (10). Same window also had may errors spike (26 in the 06:00 hour).
- Sampled 30 most recent evaluator-error sessions. For each, the last (and
  only) assistant turn JSON: `"content":[]` with `usage.output > 0`.
  Example s_1778313806951_20:
  `usage:{input:2144, output:358, cacheRead:4736} stopReason:"stop"`.
- Source split: `workflow:evaluator-aftermath` 27/30,
  `workflow:evaluator-heartbeat` 2/30, `eval-llm-scan` 1/30.
- meta.json on every sampled session: `error: "Agent ended without producing
  a response"`.
- Comparison: same-window evaluator `done` sessions (e.g. s_1778312166785_52)
  have first-assistant-turn `content` of length 2–3 with
  `stopReason:"toolUse"` — i.e. the model normally emits at least the tool
  call. The empty-content shape is specific to the failing sessions.
- Duration distribution of failures: 28/30 ≤ 9.6s, only 1 outlier at 141s.
  Not a context-window or timeout issue.

## Why this matters (load-bearing)

1. The aftermath workflow is how the closed-loop steward, eval-llm-scan,
   and the evaluator's own heartbeat actually close the loop on alerts and
   needs_triage sessions. Losing 27 aftermath reviews in 2h means ~27
   needs_triage sessions had no review written and no escalation routed.
2. This burst is correlated in time with the restart cluster KE-909 /
   KE-911 (failures continued 06:52–08:25Z across 3+ subsystems). It is a
   plausible second symptom of the same upstream cause — likely the
   gpt-5.4 backend choking under burst load or returning reasoning-only
   responses when its reasoning summary is too long for the response slot.
3. Schema-drift KEs (KE-816, KE-910) and prompt-quality KEs do **not**
   apply here. The model never reached the tool-call step. Anyone reading
   the raw error string ("Agent ended without producing a response") will
   wrongly suspect agent code; the actual cause is upstream.

## Falsifiers

- **F1**: If next 24h shows the empty-content shape disappearing without any
  harness/model change, this was a transient backend flap (analogous to
  KE-908's "transient burst, not flapping"), not a sustained capability gap.
- **F2**: If a workflow like evaluator-aftermath is changed to retry-on-empty
  and the error rate drops to near zero, then the harness was wrong to treat
  empty content as terminal — it should re-prompt or fall back.
- **F3**: If the same shape appears for non-evaluator agents at similar
  rates, the gpt-5.4-empty-content issue is system-wide and the evaluator
  concentration is just because evaluator runs the most sessions per hour
  (727/24h, ~3× may).

## Recommended next probes (not done in this heartbeat)

- Quick win: have the session harness, on detecting an empty assistant
  content with stopReason=stop and output>0, **retry once** with
  `"please respond with a tool call or final message"` before writing
  `error: "Agent ended without producing a response"`. This would have
  recovered ~67 sessions today at the cost of one extra round trip per
  burst.
- Diagnostic: log `reasoningTokens` (if Copilot exposes them) on these
  empty-content turns. If `output==reasoningTokens`, the model emitted only
  hidden reasoning, confirming the reasoning-only failure mode.
- Cross-agent rate check (F3): rerun the n=30 sample for may errors in the
  same window — if also ~100% empty-content, escalate as a model/provider
  ticket rather than an evaluator-workflow ticket.

## Schema/data lookup pattern (for next heartbeat)

```sql
-- count evaluator empty-content errors per hour
SELECT strftime('%Y-%m-%d %H:00', startedAt/1000, 'unixepoch') h, COUNT(*) c
FROM sessions
WHERE agent='evaluator' AND status='error'
  AND startedAt > (strftime('%s','now')-86400)*1000
GROUP BY h ORDER BY h;
```
For per-session shape verification, the assistant-turn JSON lives at
`.state/sessions/history/<sid>/session.jsonl`. Check
`grep '"role":"assistant"' <file> | tail -1` for `"content":[]` with
positive `usage.output`.

## Lane note

This KE is in `agents/shared/knowledge/entries/` (in-lane for arc per
heartbeat rules). No code edits attempted (out of arc lane). If this KE is
adopted, the harness change belongs to dev/may; the workflow retry policy
belongs to may.
