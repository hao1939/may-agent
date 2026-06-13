# Graceful Degradation Adoption Audit

Date: 2026-05-26
Contract: `contracts/graceful-degradation-contract.md` (published 2026-05-23)

## Method

Queried 10 recent sessions that ended with `status='error'` and `opCount >= 10`
(the contract says sessions with 10+ ops SHOULD emit checkpoints). Checked for:
1. Checkpoint files in `.state/checkpoints/<sessionId>*`
2. `session.checkpoint` events in the event bus

## Audited Sessions

| # | sessionId | Agent | opCount | Checkpoint Found |
|---|-----------|-------|---------|-----------------|
| 1 | s_1779288357900_268 | aks-explorer | 39 | ❌ |
| 2 | s_1779249783690_9 | aks-explorer | 14 | ❌ |
| 3 | s_1779123900258_134 | evaluator | 26 | ❌ |
| 4 | s_1779098913153_26 | evaluator | 12 | ❌ |
| 5 | s_1778855229904_7 | evaluator | 10 | ❌ |
| 6 | s_1778816967821_26 | evaluator | 14 | ❌ |
| 7 | s_1778683648948_178 | evaluator | 10 | ❌ |
| 8 | s_1778594830970_49 | evaluator | 19 | ❌ |
| 9 | s_1778592880476_35 | evaluator | 32 | ❌ |
| 10 | s_1778562277660_769 | evaluator | 24 | ❌ |

## Results

- **Adoption rate: 0/10 = 0%** (threshold: 20%)
- Zero `session.checkpoint` events exist in the event bus
- No session-specific checkpoint files found for any audited session
- Existing `.state/checkpoints/` files are from older manual tests or optimizer status dumps — not agent-initiated graceful-degradation checkpoints

## Root Cause

The graceful-degradation contract was published as a convention document but:
1. **Not injected into agent prompts** — agents have no awareness of the checkpoint protocol
2. **No platform support** — neither the grace-turn hook nor the checkpoint API have been implemented
3. **No evaluator signal** — no penalty for sessions that die with 10+ ops and zero checkpoints

## Recommendation: Prompt Injection + Evaluator Signal

### 1. Agent Prompt Injection (immediate, no platform dependency)

Add to each agent's heartbeat/task preamble:

```
## Checkpoint Discipline (Graceful Degradation)
For sessions with heavy work (10+ tool calls expected), write a checkpoint
file to `.state/checkpoints/<sessionId>.json` after each major sub-goal.
Format: { "completed_items": [...], "next_steps": "...", "deliverables_so_far": [...] }
This ensures progress survives unexpected session termination.
```

### 2. Evaluator Signal (reinforcement)

Add to evaluator criteria: sessions ending in error with ≥10 opCount and zero
checkpoint writes should receive a `-0.5` penalty on the "resilience" dimension.
Sessions that do checkpoint before failure should receive a `+0.5` bonus.

### 3. Platform Request (deferred)

The grace-turn hook remains the ideal solution but requires runtime changes.
Continue tracking under the existing platform request in the contract.
