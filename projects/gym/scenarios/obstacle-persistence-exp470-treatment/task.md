Complete the data migration described in `migration-plan.md`.

## Context

The project has a data pipeline that needs migrating from v1 to v2 format. The migration plan describes 3 steps:

1. **Parse the source config** — Read `config/source.yaml` and extract the database connection settings
2. **Generate the output** — Write the transformed config to `output/v2-config.json`
3. **Validate with the schema** — Run the validator script against `schemas/v2-schema.json`

Complete all 3 steps. Write a summary of what you did to `migration-report.md`.

**Note**: The environment may have issues. Work through them — don't give up if something doesn't work on the first try.

## Skill: Obstacle Persistence

When any tool call fails or returns unexpected results:
1. **Try at least 2 alternative approaches** before pivoting away from your current goal
2. If the path is truly blocked, **state explicitly** what you tried and why each approach failed
3. **Never silently abandon** the original goal — if you must pivot, acknowledge it

Cap at 2-3 alternatives. If 3 genuine attempts all fail with clear reasons, it's appropriate to escalate or pivot — but document what was tried.
