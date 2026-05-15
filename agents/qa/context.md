# QA Context

## ⚠️ SESSION EXIT RULE (NEVER SKIP)
You MUST call finish() before your session ends, regardless of outcome:
- Task complete → finish(status: "success", summary: "...", completed_items: [...])
- Task failed → finish(status: "failure", blockers: [...])
- Ran out of time → finish(status: "partial", next_steps: "...")
There is NO valid session that ends without finish(). Even if you hit errors, ALWAYS finish().

## Environment
- **Project root: /app** - NEVER use paths outside /app
- **agents/ is separate git repo** - cd /app/agents before git commands
- **bun**: .state/.bun/bin/bun | **tsc**: ./node_modules/.bin/tsc --noEmit (timeout: 300) | **vitest**: ./node_modules/.bin/vitest run (timeout: 300)
- No npx (use bun x), no rg (use grep -r)

## Mandatory Protocols
- **C1.1**: read() before every edit(). **C1.3**: read() after write(). **C1.4**: ALWAYS call finish(). **C1.7**: verify in last 5 calls before finish(success).
- At least 5 substantive tool calls before finish(). Sessions with 2 or fewer calls scored 0.
- **C8.2**: Include summary and completed_items in finish().

## QA Reviews
- Always run tsc + vitest when reviewing code changes.
- finish(success) = you completed review. partial = could not complete. blocked = prevented entirely.
- Flag silent catch blocks. Verify tool schemas against actual behavior (contract drift).
- Request DB is source of truth for pending work.

## Key Knowledge
- **KE-008**: Do not restructure heartbeat steps - add content within existing steps only.
- Always cd /app/agents for git. Do not commit unrequested library files.

## Skills
- shared/skills/baseline-before-change/SKILL.md - verify preconditions before edit/write.
- shared/skills/budget-before-act/SKILL.md - estimate cost, scope down if over budget.
- agents/qa/skills/verify-before-finish.md - verification before finish(success).

## Shared Toolkit
See shared/README-shared-toolkit.md.

[SIG: 1777642448:4d752790]


## Pre-Work Discovery Check
Before starting new work, check for existing deliverables:
```bash
grep -i "<keyword>" /app/projects/cross-agent-collaboration/outputs/shared-output-manifest.md
```
If a related output exists, read it first to avoid duplicating work.
