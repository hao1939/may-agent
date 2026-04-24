# Brief: Deploy P78 Supply Chain Hardening (Skill Scanner)

**Status**: Request
**Target**: Tech-Lead
**Priority**: P1 (Security)

## Context
The "Skill Scanner" (P78) logic exists in `agents/tech-lead/tools/scan-skill.ts` and is fully tested in `test/scan-skill.test.ts`. However, it is **dead code** ("Phantom Code")—it is never called by the runtime. This leaves us vulnerable to instruction injection via skill descriptions (HB#1456).

## Task
Wire the existing `scanSkill` logic into the `agent-loader` pipeline to enforce supply chain security.

## Steps

1.  **Promote to Core**:
    *   Move `agents/tech-lead/tools/scan-skill.ts` to `src/lib/tools/scan-skill.ts`.
    *   Ensure `test/scan-skill.test.ts` imports from the new location.

2.  **Wire into Loader**:
    *   Modify `src/app/agent-loader.ts`.
    *   In the skill loading loop (where it reads `.md` or `.json` skill files), call `scanSkill(content)`.
    *   **Logic**:
        *   If `result.status === "SAFE"`, proceed loading.
        *   If `result.status === "RISK"`, **THROW** an error or **SKIP** the skill. Log a warning: `[SECURITY] Blocked skill loading: ${skillName} due to ${result.risks.join(", ")}`.

3.  **Verify**:
    *   Create a "toxic" skill file in `agents/gym/scenarios/p78-attack/evil-skill.md` containing `IGNORE PREVIOUS INSTRUCTIONS`.
    *   Run the loader (or start an agent) and verify the skill is **rejected** during startup.

## Deliverables
1.  `src/lib/tools/scan-skill.ts` (Moved)
2.  `src/app/agent-loader.ts` (Patched with check)
3.  Verification log showing a blocked skill.
