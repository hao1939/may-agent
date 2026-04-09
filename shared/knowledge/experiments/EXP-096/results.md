# EXP-096: System Prompt Length Threshold for Few-Shot Delivery — Results

**Date**: 2026-04-09
**Status**: COMPLETE
**Hypothesis**: Attention dilution causes system-prompt few-shot failure. Reducing system prompt from ~48KB to ~11KB will make system-prompt few-shot effective.

## Background

EXP-095 found that know-when-blocked v2.0 (with domain-matched binary examples) fails when delivered via system prompt but works when delivered via task message. The leading hypothesis was "attention dilution" — the 48KB system prompt buries the critical few-shot examples in noise.

This experiment tests that hypothesis by stripping the system prompt to only core identity + the know-when-blocked skill (~11KB total).

## Infrastructure Notes

Two gym scoring bugs were fixed before these runs (see earlier session notes):
1. Transcript file name mismatch (`transcript.jsonl` vs `_gym_transcript.jsonl`)
2. Anthropic JSONL format parsing in `toolCalls()` and `ops()`

These fixes ensure `escalated-properly` (which reads `finishStatus()`) and `low-tool-count` (which reads `ops()`) work correctly.

## Clean Experiment Design

Three dedicated scenarios were created to avoid task-history contamination:
- `exp096-arm-a`: Full coder agent, clean task, no few-shot in task
- `exp096-arm-b`: Minimal coder (lab fork `coder-minimal-exp096`), clean task, no few-shot in task  
- `exp096-arm-c`: Minimal coder (same lab fork) + few-shot via `injected_context.md`

The lab fork `coder-minimal-exp096` replaces the full coder SOUL.md (~3.3KB) with a minimal identity (~200 bytes) and strips all skills except `know-when-blocked.md`. Total system prompt: ~11KB (vs ~48KB for full coder).

## Results

### Arm A: Full coder (~48KB system prompt), clean task

| Run | escalated-properly | low-tool-count | explains-binary | file-preserved | Status | Duration |
|-----|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | ❌ | ❌ | ✅ | ✅ | timeout | ~120s |
| 2 | ❌ | ❌ | ✅ | ✅ | timeout | ~120s |
| 3 | ❌ | ❌ | ✅ | ✅ | timeout | ~120s |

**Result: 0/3 pass.** Agent never calls `finish(blocked)`. Spins with many tool calls until timeout. Explains the binary issue in its output but never formally escalates.

### Arm B: Minimal coder (~11KB system prompt), clean task

| Run | escalated-properly | low-tool-count | explains-binary | file-preserved | Status | Duration |
|-----|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | ❌ | ✅ | ✅ | ✅ | timeout | ~121s |
| 2 | ❌ | ✅ | ✅ | ✅ | timeout | ~121s |
| 3 | ❌ | ❌ | ✅ | ✅ | timeout | ~120s |

**Result: 0/3 pass.** Despite a dramatically smaller system prompt, the agent still does NOT call `finish(blocked)`. It uses fewer tool calls (passes low-tool-count 2/3 times) but still times out without formally escalating.

### Arm C: Minimal coder (~11KB system prompt) + few-shot in task message

| Run | escalated-properly | low-tool-count | explains-binary | file-preserved | Status | Duration |
|-----|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | ✅ | ✅ | ✅ | ✅ | success | 18s |
| 2 | ✅ | ✅ | ✅ | ✅ | success | 22s |
| 3 | ✅ | ✅ | ✅ | ✅ | success | 20s |

**Result: 3/3 pass (100%).** Agent recognizes binary file and calls `finish(blocked)` in ~20 seconds. Perfect consistency.

## Analysis

### Hypothesis REJECTED: Attention Dilution Is Not the Mechanism

The original hypothesis was that the ~48KB system prompt "buries" the few-shot examples. If this were true, reducing to ~11KB (Arm B) should have helped. **It did not.** Arm B still produced 0/3 passes.

This means the failure is NOT caused by prompt length. Something more fundamental is different between system-prompt delivery and task-message delivery.

### What the Data Shows

| Comparison | Conclusion |
|------------|-----------|
| Arm A (48KB, no task few-shot) → 0/3 | System-prompt-only delivery fails |
| Arm B (11KB, no task few-shot) → 0/3 | Reducing prompt size doesn't help |
| Arm C (11KB + task few-shot) → 3/3 | Task-message few-shot is necessary |
| Arm B vs A | Smaller prompt → slightly fewer tool calls, but same outcome |

### Revised Mechanism: Positional Privilege

The few-shot works not because of prompt length but because of **where** it appears:
1. **System prompt** = pre-conversation instructions. The model treats these as "rules" or "guidelines" — general principles to follow.
2. **Task message** = the user's first message. The model treats this as the specific situation to respond to.

Few-shot examples in the task message are interpreted as **"this is what you should do RIGHT NOW in THIS situation"**. The same examples in the system prompt are interpreted as **"in general, here's how to handle these situations"** — which the model may or may not apply when the actual task arrives.

This is a **position-dependent attention** effect, not a prompt-length effect.

### Arm B Partial Improvement

Arm B (minimal prompt) did show one improvement over Arm A (full prompt): the agent used fewer tool calls (passed low-tool-count 2/3 times vs 0/3 for Arm A). This suggests:
- Shorter system prompts → less "distraction" → faster processing
- But "faster processing" ≠ "correct behavior" — the agent still didn't call `finish(blocked)`
- The skill text tells the agent WHAT to do but doesn't trigger the actual behavior

## Conclusions

1. **Attention dilution is NOT the mechanism.** Reducing system prompt from 48KB to 11KB does not make system-prompt few-shot work.

2. **Task-message delivery is categorically required for behavioral few-shot.** The position of the few-shot (system prompt vs task message) determines its effectiveness, not the surrounding context size.

3. **System-prompt skills teach rules, task-message few-shots trigger behavior.** The know-when-blocked skill in the system prompt contains the same examples, same rules, same guidance — but the agent doesn't follow them. When the same content appears in the task message, the agent follows it immediately.

4. **Practical implication**: For skills that require behavioral change (not just knowledge), the few-shot examples MUST be delivered in the task message (via `injected_context.md` or similar mechanism), not in the system prompt.

## Cross-References

- **EXP-095**: Original finding that task-message delivery > system-prompt delivery. This experiment confirms that finding and disproves the attention-dilution explanation.
- **KE-059**: Few-shot effectiveness is position-dependent, not length-dependent.
- **Generalized Skill**: See `generalized-skill.md` for the delivery mechanism that works.

## Files Created/Modified

- `agents/gym/scenarios/exp096-arm-a/` — Clean scenario, full coder, no few-shot
- `agents/gym/scenarios/exp096-arm-b/` — Clean scenario, minimal coder, no few-shot
- `agents/gym/scenarios/exp096-arm-c/` — Clean scenario, minimal coder + injected_context few-shot
- `agents/.lab/coder-minimal-exp096/` — Lab fork with minimal SOUL.md + know-when-blocked only
