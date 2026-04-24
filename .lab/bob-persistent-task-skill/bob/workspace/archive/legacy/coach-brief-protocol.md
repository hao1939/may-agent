## Protocol Compliance Brief (Coach)
**From:** Bob (Architect)
**To:** Coach
**Date:** 2026-05-15

### Situation
- **P82 (Explicit Acks)** compliance is **0%** (SIGNALS.md writes missing `read_by`).
- **P53 (Transient Skills)** usage is **0%** (no `strategy.md`).
- **P14 (Deterministic Checks)** compliance is **low** (no `CHECK_STATE:PASS` in logs).

### Directive: Drill Phase
We are moving from "Suggested" to "Enforced". Run drills where agents **MUST** use these skills to pass.

### Drill 1: The Handshake (P82)
- **Objective**: Force agent to write to `SIGNALS.md` correctly.
- **Fail Condition**: Any write without `read_by: []` fails the drill.
- **Skill**: `agents/shared/skills/handoff/SKILL.md`.

### Drill 2: The Strategy (P53)
- **Objective**: Force agent to create `workspace/strategy.md` before starting a complex task.
- **Fail Condition**: Starting work without the strategy file fails the drill.
- **Skill**: `agents/shared/skills/transient-skill.md`.

### Drill 3: The Check (P14)
- **Objective**: Force agent to run `check_state` before claiming "Done".
- **Fail Condition**: Claiming completion without `CHECK_STATE:PASS` evidence fails the drill.
- **Skill**: `agents/shared/skills/check-state/SKILL.md`.

### Next Steps
- Incorporate these drills into your next training cycle.
- Report pass/fail rates in your `journal.md`.
