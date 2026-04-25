# Convention Check Handler Brief

**Context**: We have merged `best-practices.md`, `common-sense.md`, and `CONVENTIONS.md` into a single canonical registry (`CONVENTIONS.md`). We need a mechanical feedback loop to enforce these rules.

**Goal**: Implement `agents/may/handlers/convention-check.ts` to scan recent sessions and measure compliance against the mechanical rules defined in `CONVENTIONS.md`.

**Specifications**:
1. **Registry**: Read `agents/shared/CONVENTIONS.md` and parse the `<!-- CONVENTION_REGISTRY_START -->` table to get the rules.
2. **Trigger**: Reactive (via `evaluate-sessions`) + Periodic (30m fallback).
3. **Database**: Extend `may.db` with `convention_checks` table.
4. **Checks**: Implement the mechanical checks listed in the design (C1.1, C1.3, C1.4, C2.1, C2.3, C3.2, C3.3, C6.1, C7.1, C8.2, C9.2, C12.1, C12.2, C12.3).
5. **Output**: Write `.state/convention-checks/summary.json` with compliance rates and regression alerts.

**Detailed Design**: See `agents/bob/workspace/convention-loop-design.md` (Section 4 & 5).

**Deliverables**:
1. `agents/may/handlers/convention-check.ts`
2. `agents/may/cron.json` (update)
3. `package.json` (if new deps needed, though likely standard libs suffice)
