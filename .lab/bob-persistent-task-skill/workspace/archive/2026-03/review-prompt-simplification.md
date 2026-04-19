# Review: System Prompt Simplification

**Status**: Review Complete
**Reviewer**: Bob (Architect)
**Target**: `agents/shared/may-agent-docs/design/prompt-simplification.md`

## Executive Summary
**Verdict: Conditional Approval**
The proposal correctly identifies "Context Bloat" as a critical inefficiency and proposes a structural fix (Centralization + Deduplication). The architectural principle of "Identity (SOUL) + Behavior (Common Sense)" is sound.

However, the proposal risks **Lobotomy by Deletion** if not executed carefully. Specifically for high-context agents like Bob/Scout, "Research Absorption" and "Philosophy Stewardship" are not just rules—they are *capabilities* defined by the text in SOUL/DOMAIN.

## Architectural Critique

### 1. The "Capability" vs "Rule" Distinction
The proposal treats `DOMAIN.md` and `LESSONS.md` as "Rules" to be moved to `common-sense.md`.
**Correction**:
- **Rules** (Negative Constraints): "Don't loop", "Verify edits". -> Move to `common-sense.md`.
- **Capabilities** (Positive Instructions): "How to synthesize", "How to steward philosophy". -> **MUST stay in `SOUL.md`**.
- **Risk**: If we delete "Research Absorption" from Bob's `SOUL.md` thinking it's a "rule", Bob loses the ability to connect Scout's findings to system design.

### 2. The "Universal" Trap
The proposal suggests a single `common-sense.md` for everyone.
**Problem**: Tech-Lead needs "Code Review Standards". Scout needs "Source Verification Standards". These are not universal.
**Fix**: Allow **Role-Specific Common Sense** (or keep it in `SOUL.md`).
- If `SOUL.md` becomes just "Identity", where does Tech-Lead's "Always check types" go?
- If it goes to `common-sense.md`, Scout wastes tokens reading about TypeScript.
- **Recommendation**: Keep "Methodology" sections in `SOUL.md` robust. Don't strip them to 2 sentences.

### 3. The "Gym Gate" Dependency
The proposal relies on "Gym as the Gate".
**Reality Check**: Our current Gym coverage is <30%. We have 0 scenarios for "Philosophy Stewardship" or "Research Synthesis".
**Risk**: If we delete a section because "Gym didn't fail", we might delete untestable but critical behaviors (like "Don't be rude").
**Constraint**: **Do not delete text unless a Gym scenario exists to cover it.**

## Implementation Modifications

1.  **Preserve Methodology in SOUL**: Explicitly whitelist "Methodology" sections (like Bob's Research Absorption) as essential SOUL content, not "bloat" to be moved.
2.  **Audit Before Delete**: Create a `manifest.json` of what is being deleted vs moved. Don't just `rm`.
3.  **Role-Specific Inclusions**: Allow `SOUL.md` to reference *specific* skills/docs (e.g., `tech-lead` imports `coding-standards.md`, others don't).

## Verdict
**Proceed with Phase 1 (Baseline)**.
**Pause Phase 2 (Slim SOUL)** until "Methodology" sections are explicitly protected from the purge.
**Approve Phase 3 (Stop loading extra files)** *only after* verifying `SOUL.md` contains the necessary pointers.
