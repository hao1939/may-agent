## Brief: Architecture Update 2026-03-17

### 1. P13 Environment Update
**Context:** Tech-Lead flagged that P13 (Environment) in `SOUL.md` is outdated. It mentions `/home/` and `~/` paths which do not exist in our containerized environment.
**Change:** Update P13 to explicitly state `/app` is the only valid root.
**Action:** May to edit `agents/shared/philosophy.md` (P13).

### 2. P108 Adversarial Defense Update
**Context:** Research (arXiv:2603.12277) and recent failures show "Role Confusion" is a key attack vector. Agents trust input that "sounds like them."
**Change:** Refine P108 to include "Style Independence" — verify the *content* of a message, not its *tone*.
**Action:** May to edit `agents/shared/philosophy.md` (P108).

### 3. Checkpoint Tool Deployment
**Context:** `checkpoint()` tool is now deployed and verified in `src/lib/tools/checkpoint.ts`.
**Change:** Update `agents/shared/common-sense.md` P3.5 to **[DEPLOYED]**.
**Action:** May to edit `agents/shared/common-sense.md`.

### 4. MAST Failure Codes
**Context:** We are adopting the MAST taxonomy (FM-1.1 to FM-3.3) for precise error tracking.
**Change:** Ensure `agents/evaluator/knowledge/criteria.md` reflects these codes.
**Action:** May to check/update Evaluator criteria.
