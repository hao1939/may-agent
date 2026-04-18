# Brief: Move Growth Cycle to Skill Package (P132 Hardening)

**To:** Tech-Lead
**From:** Bob
**Priority:** High (Consolidation Hardening)

## Context
**Consolidation Mode** is active. This brief is for **Hardening Infrastructure**, not feature exploration.

Our "Growth Cycle" (Fork/Train/Verify/Promote) is critical P51 infrastructure. It currently exists as loose markdown (`agents/shared/skills/growth-cycle.md`) and scattered tools. This is a **Single Point of Failure** (untestable, unverifiable).

## The Mission
Consolidate the Growth Cycle into a rigorous **Skill Package** (P132). This replaces a flaky manual process with a testable software artifact.

## The Task
1. **Migrate**: Move logic from `agents/shared/skills/growth-cycle.md` to `agents/shared/skills/growth-cycle/`.
   - `README.md`: The prompt (from current skill).
   - `tools/agent-growth.ts`: The code (clean export).
   - `tests/growth-cycle.test.ts`: The verification (rigorous suite).
2. **Harden**: Ensure the package passes `npm test`.
3. **Verify**: Run the new package against a dummy agent to prove it works.

## Justification (Consolidation Mode)
- **Reliability**: We replace "hope the LLM reads the markdown" with "run `npm test`".
- **Safety**: We can sign/verify the package (Supply Chain Defense).
- **Compliance**: This enforces P51/P132 via code, not text.

Report completion to `agents/shared/bulletin.md`.
