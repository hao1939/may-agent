# KE-330: Verbal Reinforcement Loop — Task-Typed Lesson Replay Closes Repeated Failure Modes

**Status**: Theoretical (strong external evidence, untested internally)
**Source**: DD-831 (Agent Learning Mechanisms Survey — Reflexion analysis)
**Confidence**: High (Reflexion: 91% HumanEval via self-correction, NeurIPS 2023; ~20% improvement per reflection cycle)
**Created**: 2026-04-22

---

## One-Sentence Summary

Tagging lessons by task archetype and replaying relevant past failure reflections when similar tasks recur — the "verbal reinforcement loop" from Reflexion — is predicted to reduce repeated failure modes by 30-50%, and our system already has the primitives (`finish()` lessons) but lacks the typing and replay wiring.

---

## The Finding

### What Reflexion Does
Reflexion (Shinn et al., NeurIPS 2023) replaces gradient updates with natural-language self-reflection stored in episodic memory:
1. **Actor** generates actions
2. **Evaluator** scores the trajectory
3. **Self-reflection** on failure: "I failed because X, next time I should Y"
4. **Episodic buffer** stores reflections, injected into subsequent trial prompts
5. **Trial loop**: Act → Evaluate → Reflect → Retry (with reflections in context)

Result: 91% on HumanEval (surpassing GPT-4's 80% at time of publication) through self-correction loops.

### Our Current State
Our agents already do verbal reinforcement via `finish()`:
- `lessons`: `[{category: "fix"|"pattern"|"insight", content: "..."}]`
- `context_updates`: persistent facts loaded into future sessions

**Three gaps vs. Reflexion**:
1. **Lessons are global, not task-typed**: A lesson from a coding task is equally likely to be shown during research or review
2. **No systematic replay on similar tasks**: Past failures on "config repair" don't get injected when the next "config repair" task arrives
3. **No explicit evaluator**: Reflexion has an evaluator scoring trajectories; our evaluation is ad-hoc

### Predicted Impact
- P-831a: Typed lesson replay will reduce repeated failure modes by 30-50% (Reflexion reports ~20% per cycle, compounding)
- This directly addresses EXP-099's finding that FM-3.3 "Verification Gravity Well" is the #1 error (20.3%) — if agents received their past verification failures on similar tasks, the loop could break

### Experiment Design
**EXP-next: Typed Lessons Replay**
1. Modify `finish()` to tag lessons by task archetype (coding/research/review/config/debugging)
2. On task start, retrieve and inject lessons matching the current task archetype
3. Measure: failure rate on repeated task types (treatment) vs. current global lessons (control)
4. Success criterion: ≥25% reduction in repeated failure modes

---

## Connections
- **Extends KE-060** (Unified Intervention Taxonomy): Verbal RL is a new delivery mechanism — lessons as M1 (analysis activation) applied preventively
- **Extends KE-065** (Few-Shot Comprehensive): Task-typed lessons are a form of experiential few-shot, but self-generated rather than curated
- **Extends KE-040** (Memory Architecture): Adds task-type indexing to the memory consolidation layer
- **Validates KE-052** (Structural Access): Typing lessons improves access structure, not content quality
- **Addresses EXP-099**: Cascade archetypes (Tool Spiral, Comprehension Cascade, Drift-to-Decay) could each be lesson-replay targets

---

*From DD#831 Reflexion analysis. Verbal reinforcement is what our lessons already do — the gap is structural access via task typing and systematic replay.*
