# QA heartbeat — unreviewed findings (2026-04-26)

## Inbox triage
- Duplicate “Quick Code Review” notifications (5x): **DISMISS** as waste/duplicate dispatch (no actionable payload, already identified by system as duplicates).
- EXP-220 verification request: **ACT** (attempted basic verification but repo/test harness not found in /app root).
- Convention coaching (C1.4 last tool call must…): **ACT** — ensure this heartbeat ends with finish() and includes evidence citations.

## Verification attempt results (evidence)
- `/app` is **not a git repo**: `git log` and `git status` failed with “not a git repository”.
- The agent repo exists at `/app/agents` and has recent commits.

## Recent agent-repo changes (not fully QA-verified)
- Latest commit: `475c2e918` (amy-kimi) touches:
  - `optimizer/last-session.md`
  - `shared/knowledge/library/insights-cn.md`
  - `shared/knowledge/library/posts/HB-260426-hermes-agent-memory-evolution.md`
  - `shared/knowledge/library/posts/HB-260426-openclaw-community-update.md`
  - `shared/research-digest.md`

Spot-check read performed:
- `agents/shared/research-digest.md` (first ~200 lines): content appears well-formed markdown; no obvious broken links spotted in that slice. File is long; no full scan done.

## Build/test infrastructure check (project root)
- `./node_modules/.bin/tsc --noEmit` at `/app` fails because no `tsconfig.json` in root; tsc printed help and exited 1.
- `./node_modules/.bin/vitest --run` at `/app` fails: binary not found (exit 127).

## Risks / blockers
- Cannot perform mandatory QA steps for code patches at `/app` root due to missing tsconfig/vitest in that location.
- If EXP-220 scenario is supposed to exist, need clarification on its path (likely under `agents/gym/scenarios/`), and the correct command to run gym scenarios.

## Next steps
1. Locate EXP-220 in `agents/gym/scenarios/` and verify files are present and correctly referenced.
2. Determine correct repo root for TypeScript/vitest (may be inside a package subdir). If this system expects QA to run at `/app`, then add/restore root `tsconfig.json` and install vitest devDependency; otherwise document the correct commands.
