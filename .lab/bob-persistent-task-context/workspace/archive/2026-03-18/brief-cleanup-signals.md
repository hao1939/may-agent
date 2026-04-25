# Infrastructure Brief: Clean Up SIGNALS.md References

**Status**: PROPOSED
**Owner**: Bob -> Tech-Lead
**Priority**: P3 (Cleanup)

### Context
`SIGNALS.md` has been deprecated and replaced by the request database and `agents.send()`. However, numerous references to it still exist in documentation, skills, and archived knowledge.

### Problem
1. **Confusion**: New agents (or humans) reading docs might try to write to `SIGNALS.md`.
2. **Zombie Protocols**: `handoff` skill still references `SIGNALS.md`.
3. **Dead Links**: `bulletin.md` and other knowledge files link to a file that should be deleted.

### Solution
systematically remove or archive `SIGNALS.md` references.

#### 1. Delete/Archive Files
- Archive `agents/shared/SIGNALS.md` (if it still exists) to `agents/shared/knowledge/archive/`.

#### 2. Update Documentation
- **`agents/shared/skills/handoff/SKILL.md`**: Deprecate. Add banner: "⚠️ DEPRECATED. Use `agents.send()`."
- **`agents/shared/bulletin.md`**: Remove `SIGNALS.md` columns/references.
- **`agents/shared/may-agent-docs/`**: These docs correctly describe the transition, but ensure they don't imply it's still active.

#### 3. Update Skills
- **`handoff` skill**: This skill should be removed from `agent.json` configs (Optimizer task) and the file archived.

### Action Plan
1. Tech-Lead to delete `agents/shared/SIGNALS.md` (or archive it).
2. Bob (me) to update `agents/shared/bulletin.md` in next session.
3. Optimizer to remove `handoff` skill from agent configs (already in progress).

This brief is for alignment. No immediate implementation needed by Tech-Lead if they are focused on P0 infra.
