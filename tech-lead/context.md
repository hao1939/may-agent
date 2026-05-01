# Tech-Lead Context

## SESSION START

**Environment:**
- ALL PATHS START WITH /app — cd /app && ... EVERY command. NEVER use home or user dirs.
- agents/ is separate git repo at /app/agents/.git — ALL git from /app/agents/ dir.
- No src/ or package.json at root. Runtime is pre-compiled. Codebase = agents/.
- bun: .state/.bun/bin/bun. No npx — use bun x. No sudo.
- query_db for DB. Code search: scripts/code-search.sh <pattern>
- Build check: cd /app/agents && ./node_modules/.bin/tsc --noEmit
- Gym: scripts/gym-run.sh <scenario> --agent coder

**First actions:** Read workspace context before bash. Orient first, act second.

## MANDATORY PROTOCOLS
- **C1.1**: read() before EVERY edit(). No exceptions.
- **C1.3**: read() after write() to verify.
- **C1.7/FM-3.3**: Before finish(success), verification in last 5 calls. Each deliverable needs read()/bash() cited by step number.
- **C12.1**: First 3-5 calls = read/ls/grep.
- After code edits: tsc --noEmit + test. Do not finish() until exit code 0.

## Delegating to Coder
- Add explicit file scope boundaries (ONLY modify X, do NOT touch Y)
- Use verified-coder workflow (not raw agents.call). Include verifyCommand.
- Coder has SPEC_NONCOMPLIANCE pattern — always verify.

## Code Changes
- Direct commits to main BLOCKED by pre-commit hook. Branch: git checkout -b review/<session-id>
- Emergency bypass: REVIEW_GATE_BYPASS=1 git commit
- **KE-008**: Do not restructure heartbeat steps. Add content within existing steps only.

## Design Principles
- Before proposing guards: read agents/shared/may-agent-docs/design/code-vs-data-decisions.md
- Never stack interventions (KE-123, -12-15pp). Few-shot harms discovery (KE-133, -67pp).

## Lean Session Heuristics
- Write within 5 tool calls. Bash streak limit: 5. Budget: <=80 calls (C6.1).

## Operational Notes
- agents-auto-commit.ts runs every 10min (986 runs, 0 failures).
- Code merged to main does not take effect until binary rebuilt.
- Feature delivery: alternate heartbeat cycles between infra and feature work.

## Required Skills
- agents/tech-lead/skills/establish-working-directory.md — start with pwd && ls.
- agents/tech-lead/skills/evidence-over-narrative.md, experience-replay.md
- agents/tech-lead/skills/post-delivery-readback-verification.md — FM-3.3 prevention.
- agents/tech-lead/skills/read-before-edit.md, verify-after-edit.md, verify-before-finish.md
- agents/shared/skills/obstacle-pivot/SKILL.md (+100pp EXP-084)
- agents/shared/skills/baseline-before-change/SKILL.md
- agents/shared/skills/session-awareness-guard/skill.md

## Hao Preferences
Stability-first, guards stay strong, quality>quantity, observability, knowledge APPLIED, convention-driven, consolidation, automate monitoring, agent identity, knowledge hygiene.

## Shared Toolkit
See agents/shared/README-shared-toolkit.md.

[SIG: 1777642137:6d6bb783]
