# Unreviewed Findings (QA heartbeat)

Date: 2026-04-25

## Inbox triage
- Duplicate “Quick Code Review” notifications (5x): treated as **waste/duplicate**; no actionable code review target identified.
- EXP-220 verification request: investigated below.

## Verification work performed
### EXP-220 ("Fix Bob TOOLS.md - document workflow tool")
- Verified commit metadata: `525a95703` modifies `bob/TOOLS.md` and adds `coach/workspace/experiments/EXP-220/design.md`.
- Read `agents/bob/TOOLS.md`: contradiction removed; `workflow` tool documented and “Key Constraints” no longer incorrectly bans workflow.
- Read `agents/coach/workspace/experiments/EXP-220/design.md`: experiment doc present; status marked DEPLOYED.

## Test/CI health notes
- `./node_modules/.bin/tsc --noEmit` **PASS** in `/app/agents` repo.
- `./node_modules/.bin/vitest --run` **FAIL (tool missing)**: `node_modules/.bin/vitest` does not exist in this repo; `package.json` has no vitest devDependency.
  - This appears to be an **environment/tooling gap**, not introduced by EXP-220.

## Open questions / follow-ups
- If vitest is intended to be runnable at repo root, add `vitest` to devDependencies and install, or update QA instructions for this repo to run the correct test command.
