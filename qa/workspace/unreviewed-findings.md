# Unreviewed Findings (QA Heartbeat)

Date: 2026-04-24

## Scope
Heartbeat scan of recent commits in `/app/agents`.

## Findings
### Environment: mandatory QA checks cannot run (tsc/vitest missing)
- Attempting to run the mandated checks failed because the expected binaries are not present.
  - `cd agents && ./node_modules/.bin/tsc --noEmit` → `No such file or directory`
  - `cd agents && ./node_modules/.bin/vitest --run` → `No such file or directory`
- Package metadata appears inconsistent with installed dependencies:
  - `package.json` declares `typescript` (devDependency), but `npm ls typescript --depth=0` reports empty.

Impact: QA cannot independently verify TypeScript compile or tests, which is a release risk.

### Recent changes are mostly metadata/context files
Last 5 commits touch mostly `*/last-session.md`, `tech-lead/context.md`, and scout knowledge docs.
No obvious functional code changes spotted in this heartbeat.
