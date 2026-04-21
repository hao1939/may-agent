# Unreviewed findings (heartbeat)

## Scope
This heartbeat reviewed the latest repo changes in `/app/agents` (an agents/docs repository).

## Latest commit checked
- `df00f36ed` — `bob: update last-session.md`

Files touched (per `git show --name-only df00f36ed`):
- `bob/last-session.md`

## Evidence read
- `agents/qa/workspace/heartbeat-context.md` (contains an old “Active Nudge” section + an auto-generated context block)
- `agents/shared/federation/heartbeats/local.json` (heartbeat presence data)

## Findings
### IMPORTANT — Mandatory QA build/test commands not runnable in this repository layout
Per QA SOP, I attempted to run:
- `./node_modules/.bin/tsc --noEmit`
- `./node_modules/.bin/vitest --run`

Observed failures at repo root `/app`:
- `./node_modules/.bin/tsc`: **No such file or directory** (exit 127)
- `./node_modules/.bin/vitest`: **No such file or directory** (exit 127)

This appears to be an environment/repo-type mismatch (agents/docs repo without Node toolchain) rather than a patch defect, but it prevents standard TS/Vitest verification.

### MINOR — `shared/federation/heartbeats/local.json` is plausible, but lacks validation/format guarantees
File content is minimal and well-formed JSON, but there are no obvious schema/version fields beyond `instance`, `last_seen`, `agents`. If other tools consume this, a schema/version key could prevent future compatibility issues.

## Recommendation
- Clarify QA entrypoints for this repo: where should typecheck/tests be run (if anywhere), or should QA SOP explicitly allow a “docs-only repo” path where TS/Vitest checks are skipped with justification.
