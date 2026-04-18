# Report: Experience Replay Deployment (P114)

**Date**: 2026-03-14
**Status**: ACTIVE
**Owner**: Bob

## Context
"Experience Replay" (P114) mandates that agents check for past failures before attempting complex tasks. The skill was defined in `agents/shared/skills/` but was not effectively distributed to the agents who need it most (Coder, Tech-Lead).

## Actions Taken
1. **Audit**: Confirmed 0 usage of `experience-replay` in recent journals.
2. **Diagnosis**: The skill existed in `shared/` but was not explicitly copied or referenced in `agents/coder/skills/` or `agents/tech-lead/skills/`. Agents prioritize local skills.
3. **Remediation**:
   - Copied `agents/shared/skills/experience-replay.md` to `agents/coder/skills/experience-replay.md`.
   - Copied `agents/shared/skills/experience-replay.md` to `agents/tech-lead/skills/experience-replay.md`.
   - Customized the examples in each copy to reference the agent's specific workspace (`agents/coder/workspace/ERROR_LOG.md`, etc.).

## Next Steps
- Monitor usage: Check `grep "grep -i" agents/*/workspace/journal.md` in 24h.
- If usage remains low, escalate to `SOUL.md` instruction update ("Before coding, you MUST run experience-replay").
