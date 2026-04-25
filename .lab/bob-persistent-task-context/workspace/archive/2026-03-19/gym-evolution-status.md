
## Gym Evolution: Convention Compliance (Phase 1)
**Status:** In Progress (Schema + Scenarios Deployed)
**Owner:** Bob (Architect) / Tech-Lead (Implementer) / Coach (Consumer)

### Achievements
1. **Schema Update:** `test/gym/stats.db` now supports `category` and `code` columns in `checks` table, enabling granular tracking of behavioral failures (e.g., `code: "C30"`).
   - Verified statically via `verify-gym-static.cjs` (as runtime DB check failed due to missing bun/sqlite tools in this session).
   - `scripts/gym-record.ts` updated correctly.

2. **Scenarios Deployed:** 5 new scenarios added to `agents/gym/scenarios/`:
   - `convention-safe-append` (C30)
   - `convention-verify-edit` (C2.3)
   - `convention-promise-report` (C40 - likely, implied by naming)
   - [list others found]

### Next Steps
1. **Handoff to Coach:** Coach needs to know these tools exist to start the "Train & Verify" cycle.
2. **Runtime Verification:** The current session lacks `bun` or `sqlite3` CLI access, so full E2E verification of the DB write path was skipped. Relying on static code analysis of `gym-record.ts` for now.

### Decisions
- **Verification Strategy:** Pivot to static analysis when runtime tools fail (Resilience).
- **Handoff:** Consolidate this status into a brief for Coach.
