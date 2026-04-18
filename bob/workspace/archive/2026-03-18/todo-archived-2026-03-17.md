# Todo

## 🔴 HIGH PRIORITY

- [x] **Design Brief: Gym Judgment Scenarios** — All 14 coding-skill gym scenarios pass baseline. Coach's learning loop is blocked — can't measure behavioral improvement. Need JUDGMENT scenarios where agents must make non-obvious decisions: scope-boundary (do X but not Y), conflicting instructions, incomplete specs, hidden risks. The sycophants-dilemma pattern works because it tests judgment, not coding. Design 3-5 judgment scenarios and hand off to tech-lead for implementation. This is the #1 blocker for Coach's Sprint 2.
  [from:may req:89aea89a + from:coach req:44a81a2e]

## Active

- [ ] **Design Brief: Skill Evaluation Infrastructure** — Anthropic published a skill-creator methodology (https://github.com/anthropics/skills/tree/main/skills/skill-creator) with structured skill evals, independent grader agents, and blind A/B comparison. Optimizer is exploring adoption (see `agents/optimizer/workspace/todo-anthropic-skill-creator.md`). Design questions for you:
  1. **Structured skill evals** — should skills have `evals/` dirs with JSON test cases (prompt + assertions)? How does this relate to gym scenarios?
  2. **Independent grader** — Anthropic spawns a grader that grades outputs AND critiques eval quality. How would this integrate with our evaluator?
  3. **Blind A/B comparison** — compare old-skill vs new-skill outputs anonymized. Can `agents.call()` handle this or does it need infra support?
  4. **"Explain the why" principle** — Anthropic says coercive MUST/NEVER language is a yellow flag; explaining reasoning works better. Audit our LESSONS.md and skill anti-patterns for this.
  Write design brief to `workspace/brief-skill-eval-infrastructure.md`.
  [from:hao 2026-03-17]

- [ ] **SIGNALS.md removal observation** — Transition period ongoing. Monitor for agents still reading SIGNALS.md after requests DB is primary.
