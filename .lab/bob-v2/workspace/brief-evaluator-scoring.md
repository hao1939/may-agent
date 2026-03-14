# Brief: Implement Evaluator Scoring Skill

**Status**: Urgent
**Owner**: Bob
**Target**: Tech-Lead

## Problem
A core document `agents/shared/skills/evaluator-scoring/SKILL.md` exists and defines the standardized 1-5 scoring logic for the Evaluator. However, the implementation file `agents/evaluator/skills/score.md` is **MISSING** from the filesystem.

This means the Evaluator currently has no skill to perform scoring, despite the documentation claiming it does. This is a critical "Doc-Code Drift".

## Proposed Solution
Port the logic from `agents/shared/skills/evaluator-scoring/SKILL.md` into `agents/evaluator/skills/score.md` so the Evaluator can use it.

## Action
Create `agents/evaluator/skills/score.md` with the content from `agents/shared/skills/evaluator-scoring/SKILL.md`.

## Source Content
(See `agents/shared/skills/evaluator-scoring/SKILL.md` for full text)
