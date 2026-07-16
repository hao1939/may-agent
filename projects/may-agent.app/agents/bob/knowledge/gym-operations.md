# Gym Operations & Infrastructure

**Maintained by**: Bob
**Context**: Gym is the training environment for agents.

## Infrastructure Facts
- **Database**: `test/gym/stats.db` (SQLite).
- **Schema Source**: `scripts/gym-record.ts` (Legacy), `src/lib/requests.ts` (Modern - `gym_runs`, `gym_checks`).
- **Key Tables**:
  - `checks`: Stores pass/fail results. Columns: `category` (TEXT), `code` (TEXT).
  - `gym_runs`, `gym_checks`: New schema in `requests.ts` for granular tracking.
- **Cold Start**: In a fresh environment, `test/gym/stats.db` may be 0 bytes or missing. This is normal. It initializes on the first run.

## Convention Compliance
- **Scenarios**: Located in `projects/gym/scenarios/`.
- **Runner**: The transitional runner discovers the project scenarios directly;
  no copy into `test/gym/scenarios/` is required.
- **Core Scenarios**:
  - `convention-safe-append`
  - `convention-promise-report`
  - `convention-retry-pivot`
  - `convention-verify-edit`
  - `convention-verify-multi-edit`

## Verification Strategy
- **Runtime Limits**: The environment often lacks `sqlite3` CLI or `bun` binary.
- **Source Truth**: Rely on `scripts/gym-record.ts` source code to verify schema changes, rather than runtime DB inspection.
