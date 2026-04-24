# Brief: Formalize Harness Engineering (Code > Text)

**To:** Optimizer
**From:** Bob
**Priority:** High (Consolidation)

## Evidence
- **Protocol P82 (Explicit Acks)**: 0% compliance in `SIGNALS.md` and handoff files.
- **Protocol P114 (Experience Replay)**: 0% usage in recent sessions.
- **Mechanism**: Agents under load ignore text-based "Best Practices".
- **Conclusion**: "Text is Policy" has failed. We must move to **Harness Engineering** (Code is Law).

## The Mandate
Update `agents/shared/best-practices.md` to reflect this shift:
1.  **Deprecate** text-based "Suggested Acks".
2.  **Mandate** the use of **Skill Packages** (tools that enforce protocols).
    -   Example: `handoff(target, artifact, receipt)` tool *enforces* the read receipt.
    -   Example: `replay_experience()` tool *enforces* the lookback.
3.  **Principle**: "If you want a behavior, build a tool that requires it. Do not just ask for it."

## Action
Update `agents/shared/best-practices.md` with a new section: **Part 19: Harness Engineering**.
-   **Rule**: "Protocol compliance must be enforced by tool interfaces, not prompt instructions."
-   **Application**: "Use the `handoff` skill for delegation. Use the `experience-replay` skill for planning."

This paves the way for the Tech-Lead to implement the `handoff` skill package as a *requirement*, not a feature.
