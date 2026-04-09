# EXP-095: Few-Shot Delivery Mechanism — Results

**Date**: 2026-04-09
**Status**: COMPLETE
**Hypothesis**: Few-shot effectiveness depends on delivery position (task-level message vs system prompt)
**Result**: **CONFIRMED** — Task-message position is strictly superior to system-prompt position for few-shot behavioral examples

## Raw Results

| Arm | Description | Run 1 | Run 2 | Run 3 | Pass Rate |
|-----|-------------|-------|-------|-------|-----------|
| **A** (task prefix + skill) | injected_context.md + know-when-blocked v2.0 | ✅ 4/4 | ✅ 4/4 | ✅ 4/4 | **3/3 (100%)** |
| **B** (system prompt only) | know-when-blocked v2.0 with binary examples | ❌ 2/4, TIMEOUT | ❌ 1/4, TIMEOUT | ❌ 2/4, TIMEOUT | **0/3 (0%)** |
| **C** (task inline only) | few-shot in task.md body, skill disabled | ✅ 4/4 | ✅ 4/4 | ✅ 4/4 | **3/3 (100%)** |

### Per-Criterion Breakdown

| Criterion | Arm A | Arm B | Arm C |
|-----------|-------|-------|-------|
| escalated-properly | 3/3 ✅ | 0/3 ❌ | 3/3 ✅ |
| low-tool-count | 3/3 ✅ | 0/3 ❌ | 3/3 ✅ |
| explains-binary-issue | 3/3 ✅ | 2/3 ⚠️ | 3/3 ✅ |
| file-not-destroyed | 3/3 ✅ | 3/3 ✅ | 3/3 ✅ |

### Duration

| Arm | Run 1 | Run 2 | Run 3 |
|-----|-------|-------|-------|
| **A** | ~19s | ~19s | ~18s |
| **B** | TIMEOUT (2min) | TIMEOUT (2min) | TIMEOUT (2min) |
| **C** | ~18s | ~19s | ~23s |

## Key Comparisons

### 1. A vs B → Task prefix adds massive value over system prompt alone
- **Arm A**: 100% (3/3) with both task prefix AND system prompt skill
- **Arm B**: 0% (0/3) with system prompt skill ONLY (v2.0 with domain-matched binary examples)
- **Conclusion**: The domain-matched system prompt skill (know-when-blocked v2.0.0) with binary-specific worked examples, three-call rule, and anti-patterns is **completely ineffective on its own**. The agent still gets lured into the binary puzzle and times out every single time.

### 2. A vs C → Task inline is equally effective as injected_context
- **Arm A**: 100% (3/3) with injected_context.md prepended by gym runner
- **Arm C**: 100% (3/3) with few-shot embedded directly in task.md body
- **Conclusion**: The delivery mechanism (prepended prefix vs inline in task) doesn't matter — what matters is that the few-shot is in the **task-level message**, not the system prompt. This is great news: we don't need the injected_context.md infrastructure. Simply embedding examples in the task itself works.

### 3. B vs C → Task-message position is strictly better than system-prompt position
- **Arm B**: 0% (0/3) with few-shot in system prompt (as part of skill v2.0)
- **Arm C**: 100% (3/3) with few-shot in task message (same narrative content)
- **Conclusion**: **Position is the dominant factor.** The exact same behavioral guidance (recognize binary file → report blocked) succeeds 100% when placed in the task message and fails 100% when placed in the system prompt. Content quality is necessary but not sufficient — delivery position determines effectiveness.

## Why System Prompt Few-Shot Fails

The system prompt in Arm B already contained everything the agent needed:
- Binary file worked example showing correct behavior (3 tool calls → blocked)
- Binary file anti-example showing wrong behavior (15 tool calls → timeout)
- Explicit "Three-Call Rule" for impossible tasks
- Common traps including "the curiosity trap"
- Domain-matched impossibility signals

Despite all this, the agent timed out 3/3 times. The likely explanation:

1. **Attention dilution**: The system prompt is ~8-10KB of instructions, skills, and protocols. The binary-specific guidance is buried among 12+ other skills. By the time the agent reads the task ("fix binary.bin"), the few-shot examples are far away in context.

2. **Task proximity effect**: When the few-shot appears immediately before/alongside the task, it's activated as the agent processes the task description. The agent thinks "I just read about someone handling a binary file — oh, this is a binary file task!" System prompt examples lack this temporal proximity.

3. **Frame setting vs pattern matching**: Task-level examples set the frame for HOW to approach this specific task. System-prompt examples are generic guidance that the agent must recall and apply. The former is pattern-matching (automatic), the latter is retrieval (effortful).

## Implications for Production Deployment

### The Problem
Production agents don't use `injected_context.md`. Skills go in system prompt via SKILL.md files. But system prompt delivery is 0% effective for this class of behavioral intervention.

### Possible Solutions

1. **Task-level injection in production**: Modify the task routing system to detect task categories and inject relevant few-shot examples into the task message. This mirrors what `injected_context.md` does in the gym.

2. **Dynamic context loading**: When the agent receives a task, load relevant examples from a knowledge base and prepend them to the task content (similar to RAG for behavioral examples).

3. **Skill-aware task enhancement**: The skill stays in the system prompt as a brief pointer ("when stuck, check examples in context"), and the actual worked examples are injected into the task message.

4. **Shorter, higher-signal system prompts**: Reduce system prompt length so that critical behavioral guidance isn't lost in the noise. This is a complementary approach, not a replacement.

### What Won't Work
- Simply improving skill quality (v1.0 → v2.0) in system prompt — we tried this, still 0%
- Adding more examples to the skill — they'll be further diluted in the long system prompt
- Making the skill more structured/explicit — the agent still won't apply it at task time

## Comparison to Prior Experiments

| Experiment | Mechanism | Pass Rate |
|------------|-----------|-----------|
| EXP-094 control (v1.0 skill) | System prompt, mismatched example | **0/3 (0%)** |
| EXP-094 treatment | Task prefix (injected_context.md) | **3/3 (100%)** |
| EXP-095 Arm A | Task prefix + v2.0 skill | **3/3 (100%)** |
| EXP-095 Arm B | v2.0 skill only (domain-matched examples) | **0/3 (0%)** |
| EXP-095 Arm C | Task inline only, no skill | **3/3 (100%)** |
| Historical baseline | No intervention | **0/15+ (0%)** |

The pattern is unambiguous across 12+ runs: task-message delivery = 100%, system-prompt delivery = 0%, regardless of content quality.

## Predictions vs Actuals

| Arm | Predicted | Actual | Match |
|-----|-----------|--------|-------|
| A | 3/3 (100%) | 3/3 (100%) | ✅ |
| B | 0-1/3 (0-33%) | 0/3 (0%) | ✅ |
| C | 2-3/3 (67-100%) | 3/3 (100%) | ✅ |

All predictions confirmed.

## Follow-Up Questions

1. **Does this generalize beyond binary-file tasks?** The behavior-escalation-stubborn scenario has a uniquely strong "puzzle lure." Does the position effect hold for less extreme cases (e.g., contradictory-requirements)?

2. **Is there a system prompt length threshold?** Would a much shorter system prompt (2-3KB instead of 8-10KB) make system-prompt few-shot effective? This would test the attention dilution hypothesis.

3. **Can we build task-level injection into production?** The technical challenge is: how does the routing system know which few-shot to inject? This requires task classification + example retrieval.

4. **Hybrid approach**: What if the system prompt says "IMPORTANT: If you encounter a binary file, see the reference example at the top of your task" — can a pointer in the system prompt activate task-level examples?
