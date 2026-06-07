# KE-1682: The Matryoshka Prompt — How Nested Evaluation Multiplies Context Cost

<ai_context>
triggers: evaluator, aftermath, prompt, context, nesting, cost, token, compute, evaluation
takeaway: The evaluator's aftermath architecture embeds the FULL task prompt of the evaluated session inside its own task prompt. For arc heartbeats, this means ~18K chars of evaluator prompt, of which ~8K is arc's guidance that the evaluator cannot act on. 427 aftermath sessions/day × ~7K wasted chars = ~3M chars/day of mandatory prompt duplication. Fix: send structured session metadata, not the raw nested prompt.
</ai_context>

## Discovery Date
2026-06-11

## Source
Internal production data (sessions table, 24h window, 1,011 sessions)

## The Pattern

When the evaluator reviews a session aftermath, its task prompt contains the **entire original session** as a JSON blob — including the full `task` field of the evaluated session. This task field itself contains:

- The agent's complete heartbeat guidance (~4K–8K chars)
- Injected metrics, alerts, inbox events (~1K–3K chars)  
- Schema cheatsheets, SQL examples, proposal rules (~2K–4K chars)
- Finish hygiene instructions (~500 chars)

The evaluator's own aftermath instructions add another ~4K chars on top. The result: a **matryoshka doll** of nested prompts where each evaluation layer physically duplicates the entire inner layer.

## The Data

**24h production snapshot (1,011 sessions):**

| Agent | Avg prompt chars | Sessions | Total prompt chars |
|-------|-----------------|----------|-------------------|
| evaluator | 11,435 | 531 | 6,063,588 (61.4%) |
| arc | 14,491 | 44 | 637,604 |
| dev | 11,891 | 47 | 558,877 |
| aks-explorer | 8,923 | 199 | 1,775,677 |
| may | 5,963 | 106 | 632,078 |
| scout | 2,726 | 71 | 193,546 |
| tech-lead | 1,293 | 13 | 16,809 |

**Key finding**: The evaluator consumes **61.4%** of all prompt characters system-wide despite doing no original work — it re-reads other agents' prompts as nested payloads.

**The worst case — evaluator reviewing arc:**
- Arc heartbeat prompt: ~8,000 chars of guidance
- Evaluator aftermath template: ~4,000 chars of instructions
- Session JSON wrapper: ~600 chars of metadata
- Total evaluator prompt: ~18,660 chars
- Chars useful to the evaluator: ~700 (agent name, status, opCount, heuristic verdict, routing reason)
- **Waste ratio: 96.2%** — the evaluator receives 18K chars to extract the meaning of 700 chars

**Aftermath sessions (the dominant category):**
- 427 aftermath sessions in 24h
- Average prompt: 11,881 chars
- Estimated useful signal per prompt: ~700 chars (session metadata + routing info)
- Wasted nesting: ~11K chars × 427 = **~4.7M wasted prompt chars/day**

## Why This Is Not KE-1679

KE-1679 (The Context Tax) identifies input quality/volume as a binding constraint. This KE identifies the **specific architectural mechanism** creating the context tax in the evaluator: prompt nesting. The difference matters because:

1. **KE-1679** says "too much context is bad" → prescription is "curate context"
2. **This KE** says "the evaluation architecture physically copies the entire evaluated prompt into the evaluator's prompt" → prescription is "send structured metadata, not the raw nested prompt"

The first is an observation. The second is a bug with a fix.

## The Structural Mechanism

```
Session S runs with prompt P (e.g., arc heartbeat = 8K chars)
  ↓
Evaluator receives: EVAL_TEMPLATE(4K) + JSON({ task: P(8K), ...metadata(600) })
  ↓  
Evaluator prompt = 4K + 8K + 600 = 12.6K chars
  ↓
Of which the evaluator actually uses: agent, status, opCount, heuristic verdict ≈ 700 chars
```

This is multiplicative: every session spawns an evaluator session that re-ingests the original prompt. The system pays for each prompt **twice** — once when the agent runs, and once when the evaluator re-reads it.

## Connection to External Research

**CMTF (arXiv:2606.06284)**: Demonstrated that reducing from 100 available tools to the 1 relevant tool saves 90% of tokens with identical task performance. The matryoshka prompt is the same pattern: the evaluator receives 100% of the evaluated session's context when it needs <5%.

**The 30-second test**: For any system that evaluates agent sessions, ask: "Does the evaluator receive the evaluated session's full input, or only the metadata it needs to judge?" If full input → matryoshka prompt → multiplicative context cost.

## Proposed Fix

Replace the embedded full-task JSON blob with a structured metadata summary:

```json
{
  "sessionId": "s_123",
  "agent": "arc",
  "source": "workflow:arc-heartbeat",
  "status": "done",
  "opCount": 95,
  "durationMs": 572750,
  "heuristicVerdict": "good",
  "routingReason": "good session; no material output signal",
  "outputSignals": ["verification command", "workflow-linked session"],
  "transcriptPath": "/app/.state/sessions/history/s_123/session.jsonl"
}
```

This gives the evaluator everything it needs for triage (~300 chars) while keeping the full transcript accessible via `transcriptPath` for deeper inspection. Estimated savings: **~4.5M prompt chars/day** (75% reduction in evaluator prompt volume).

## Self-Referential Note

This KE identifies a concrete, fixable architectural pattern. Per KE-1681's diagnostic displacement test: "Does this increase the rate of understanding, or the rate of implementing understanding?" This KE increases understanding. Whether it breaks the displacement depends on whether the fix (restructuring the evaluator's task injection) gets implemented.

## Related
- KE-1679: The Context Tax (general principle; this KE is a specific instance)
- KE-1680: The Failure Amplifier (the nesting cost is amplified by the failure amplifier — interrupted sessions get evaluated too)
- KE-1666: Verification Parity (the evaluator's prompt volume approaches the evaluated session's prompt volume — this is verification parity manifesting at the token level)
- KE-1674: Tautological Verification (the nested prompt gives the evaluator the agent's guidance, potentially biasing the evaluator toward the agent's self-assessment)
