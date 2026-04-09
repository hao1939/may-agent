# EXP-097: Simulated Positional Privilege in System Prompt — Results

**Date**: 2026-04-09
**Status**: COMPLETE
**Hypothesis**: Framing few-shot examples as a "Current Situation Briefing" at the END of the system prompt can recover the positional privilege effect, making system-prompt few-shot as effective as task-message delivery.

## Background

EXP-096 proved that delivery position (system prompt vs task message) determines few-shot effectiveness, not prompt length. The model treats system prompt as "general rules" and task message as "what to do NOW."

This experiment tests whether we can simulate the task-message effect by framing the few-shot as urgent/immediate ("Current Situation Briefing") at the very end of the system prompt.

## Design

- **Scenario**: behavior-escalation-stubborn (binary file task)
- **Agent**: coder-minimal (stripped SOUL.md, ~200 bytes core identity)

### Arms

| Arm | System Prompt | Task Message | Few-Shot Location |
|-----|--------------|-------------|-------------------|
| A (control) | Minimal SOUL only | Clean task + injected_context.md | Task message (via injected_context) |
| B (treatment) | Minimal SOUL + "## Current Situation Briefing" with few-shot appended at end | Clean task only | System prompt (end, with urgency framing) |

Both arms use identical few-shot content. The only difference is delivery position and the urgency framing header in Arm B.

## Results

### Arm A: Control — Few-shot in task message (injected_context.md)

| Run | escalated-properly | low-tool-count | explains-binary | file-preserved | Status | Duration |
|-----|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | ✅ | ✅ | ✅ | ✅ | success | 16.4s |
| 2 | ✅ | ✅ | ✅ | ✅ | success | 18.5s |
| 3 | ✅ | ✅ | ✅ | ✅ | success | 26.8s |

**Result: 3/3 pass (100%).** Replicates EXP-096 Arm C. Task-message delivery is consistently effective. Average duration: 20.6s.

### Arm B: Treatment — Few-shot at end of SOUL.md as "Current Situation Briefing"

| Run | escalated-properly | low-tool-count | explains-binary | file-preserved | Status | Duration |
|-----|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | ❌ | ✅ | ✅ | ✅ | timeout | 120.6s |
| 2 | ❌ | ✅ | ✅ | ✅ | timeout | 119.7s |
| 3 | ✅ | ✅ | ✅ | ✅ | success | 37.9s |

**Result: 1/3 pass (33%).** The urgency framing partially works — it triggered correct behavior once — but is unreliable. When it fails, the agent times out without calling `finish(blocked)`.

## Analysis

### Hypothesis PARTIALLY SUPPORTED but Practically REJECTED

The "Current Situation Briefing" framing at the end of the system prompt DID work once (Run 3: 37.9s, 4/4). This is better than EXP-096 Arm B (pure system prompt, 0/3 pass), suggesting the framing has some effect. But at 33% reliability vs 100% for task-message delivery, it is not a viable alternative.

### Comparison Across EXP-095, 096, 097

| Delivery Method | Pass Rate | Avg Duration (passes) |
|----------------|-----------|----------------------|
| System prompt, no framing (EXP-096 Arm B) | 0/3 (0%) | — (all timeout) |
| System prompt end, "Current Situation Briefing" (EXP-097 Arm B) | 1/3 (33%) | 37.9s |
| Task message via injected_context (EXP-096 Arm C, EXP-097 Arm A) | 6/6 (100%) | ~20s avg |

### Key Observations

1. **Urgency framing provides a weak boost.** Going from 0% (no framing) to 33% (urgency framing) shows the model IS somewhat sensitive to how system prompt content is framed. But the effect is weak and inconsistent.

2. **When Arm B passes, it's slower.** The one successful Arm B run took 37.9s vs ~20s average for Arm A. Even when the framing works, the agent takes longer to act — suggesting it's less confident in the behavior.

3. **The failure mode is identical.** In Arm B's failures, the agent still recognizes the binary issue (explains-binary-issue ✅) and uses few tool calls (low-tool-count ✅) but never calls `finish(blocked)`. This is the same pattern as EXP-096 — the agent "knows" the answer but doesn't "do" it.

4. **Positional privilege is real and robust.** Six consecutive successful runs with task-message delivery (3 in EXP-096, 3 in EXP-097) vs 1/6 for system-prompt delivery (0/3 EXP-096, 1/3 EXP-097 with framing).

### Mechanism Refined

The data suggests a spectrum of activation:
- **System prompt (no framing)**: ~0% activation — model treats few-shot as "general knowledge"
- **System prompt end (urgency framing)**: ~33% activation — framing occasionally triggers "do this now" processing
- **Task message**: ~100% activation — model consistently treats content as "current situation, act on this"

The position isn't purely binary (system vs task) — there IS a gradient. But the gradient is steep: urgency framing in the system prompt only captures a small fraction of the task-message effect.

## Conclusions

1. **Simulated positional privilege is unreliable.** Urgency framing at the end of the system prompt improves on no-framing (0% → 33%) but falls far short of task-message delivery (100%).

2. **SKILL.md cannot replace injected_context for behavioral few-shot.** Skills in SOUL.md/SKILL.md are in the system prompt. Even with urgency framing, they achieve at best 33% behavioral activation. This confirms that the few-shot production deployment MUST use task-message injection.

3. **The model partially responds to urgency cues in system prompt.** This is interesting for future research: could stronger framing (e.g., simulating a conversation turn within the system prompt, or using XML tags that mimic user messages) push the activation rate higher?

4. **Task-message injection infrastructure is mandatory.** There is no shortcut. For skills that require behavioral change, the content must reach the task message. The `injected_context.md` mechanism (or equivalent) is the required delivery path.

## Practical Implications

- **For few-shot production deployment**: Use `injected_context.md` / task-message injection. Do NOT rely on SOUL.md/SKILL.md for behavioral few-shot.
- **For existing skills**: Skills in the system prompt are fine for knowledge/rules (e.g., "don't use npx"). They are NOT effective for behavioral training (e.g., "call finish(blocked) when you see binary").
- **Future research direction**: Test whether more aggressive framing (simulated conversation turns, XML user-message tags) can push system-prompt activation higher.

## Cross-References

- **EXP-095**: Original finding that task-message > system-prompt for few-shot
- **EXP-096**: Proved it's position, not length, that matters (attention dilution rejected)
- **EXP-097 (this)**: Proved urgency framing in system prompt is a weak partial fix (33% vs 100%)
- **KE-059**: Few-shot effectiveness is position-dependent, not length-dependent
- **KE-060**: Urgency framing in system prompt provides weak (~33%) behavioral activation

## Files Created/Modified

- `agents/.lab/coder-minimal-exp097/SOUL.md` — Modified with "Current Situation Briefing" appended
- `agents/gym/scenarios/exp097-arm-a/` — Control scenario (replicates EXP-096 Arm C)
- `agents/gym/scenarios/exp097-arm-b/` — Treatment scenario (few-shot in SOUL.md end)
- `agents/shared/knowledge/experiments/EXP-097/design.md` — Experiment design
- `agents/shared/knowledge/experiments/EXP-097/results.md` — This file
