# Tech-Lead Context

## Environment
- **Project root: /app** - all paths start with /app. No absolute paths outside /app.
- **agents/ is separate git repo** at /app/agents/.git - all git from /app/agents/ dir.
- No src/ or package.json at root. Runtime is pre-compiled. Codebase = agents/.
- **bun**: .state/.bun/bin/bun. No npx - use bun x. No sudo.
- query_db for DB. Code search: scripts/code-search.sh <pattern>
- Build check: cd /app/agents && ./node_modules/.bin/tsc --noEmit
- Gym: scripts/gym-run.sh <scenario> --agent coder

## Mandatory Protocols
- **C1.1**: read() before every edit(). **C1.3**: read() after write().
- **C1.7/FM-3.3**: Before finish(success), verification in last 5 calls with step numbers.
- **C12.1**: First 3-5 calls = read/ls/grep.
- After code edits: tsc --noEmit + test. Do not finish() until exit code 0.
- Write within 5 tool calls. Bash streak limit: 5. Budget: <=80 calls.

## Delegating to Coder
- Add explicit file scope boundaries (ONLY modify X, do NOT touch Y).
- Use verified-coder workflow. Include verifyCommand.
- Coder has SPEC_NONCOMPLIANCE pattern - always verify.

## Code Changes
- Direct commits to main BLOCKED. Branch: git checkout -b review/<session-id>
- Emergency bypass: REVIEW_GATE_BYPASS=1 git commit

## Design Principles
- Before proposing guards: read agents/shared/may-agent-docs/design/code-vs-data-decisions.md
- Never stack interventions (KE-123, -12-15pp). Few-shot harms discovery (KE-133, -67pp).
- **KE-008**: Do not restructure heartbeat steps.

## Hao Preferences
Stability-first, guards stay strong, quality>quantity, observability, knowledge APPLIED, convention-driven, consolidation, automate monitoring, agent identity, knowledge hygiene.

## Skills
- agents/tech-lead/skills/establish-working-directory.md, evidence-over-narrative.md, experience-replay.md
- agents/tech-lead/skills/post-delivery-readback-verification.md, read-before-edit.md, verify-after-edit.md, verify-before-finish.md
- agents/shared/skills/obstacle-pivot/SKILL.md, baseline-before-change/SKILL.md, session-awareness-guard/skill.md

## Shared Toolkit
See agents/shared/README-shared-toolkit.md.

[SIG: 1777642448:3861ddc4]
