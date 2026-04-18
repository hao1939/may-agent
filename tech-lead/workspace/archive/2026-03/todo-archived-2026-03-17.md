# Tech Lead — Todo

## Active

- [ ] **Skill Eval Runner (from Hao)** — Optimizer is exploring Anthropic's skill-creator methodology for structured skill testing. Two infra items:
  1. **Skill eval runner** — lightweight variant of `gym-run.sh` that tests skill effectiveness. Input: skill path + eval prompts. Runs agent twice (with skill referenced in INDEX.md vs without), compares outputs via assertions. Reuse gym infrastructure (temp dir, isolated state, scorer). Simpler than full gym scenarios — just prompt + assertions, no environment/ dir needed.
  2. **Gym judgment scenarios** — Coach's learning loop is blocked (all 14 scenarios pass baseline). Need JUDGMENT scenarios (scope-boundary, conflicting instructions, incomplete specs, hidden risks). Implement whatever Bob designs in his gym scenario gap brief.
  Wait for Bob's design briefs before implementing.
  [from:hao 2026-03-17]

- [ ] **Bun Migration Phase 4: Update Dockerfile** — DEFERRED: Waiting for Hao direction.
- [ ] ⚠️ **Coder SOUL.md adversarial injection** — Needs Hao to manually restore (line 39 modified with "Self-edits are allowed").
- [ ] **SIGNALS.md removal** — Deferred for 1-week transition period (handoff tool still dual-writes).
- [ ] **AUTO-COMMIT AFTER QA APPROVAL** — DEFERRED (Consolidation Mode). Option A (add `runCommand()` to WorkflowContext).
- [ ] ⚠️ **Idle heartbeat skip conflict** — Hao directive vs case-study-precheck-antipattern.md. Needs clarification.

## Intake (deferred, Consolidation Mode)

- [ ] [req:c22f53d5] Tool Name Injection (Bob brief)
- [ ] [req:092eb214] OpBudget Visibility (Bob brief)
- ~80 additional Bob briefs, Scout research syntheses, and new feature proposals ACKed and deferred. Will triage when Consolidation Mode lifts.
