# EXP-212 Phase 2: Schema-Organized Context Deployment

**Date**: 2026-07-31
**Status**: DEPLOYED
**Target**: tech-lead/context.md

## Changes Made

Restructured tech-lead's context.md from topic-based flat sections to **trigger-based schema** with:
1. `[SESSION START]` section — facts needed immediately (path, git, env)
2. `[WHEN RUNNING TOOLS]` — tool availability grouped by use-case
3. `[WHEN DELEGATING]` — coder patterns
4. `[BEFORE FINISH]` — verification protocols
5. Cross-references between co-activated facts
6. **Bold** on most-violated facts (top-5 from Phase 1)

## Schema Design Rationale

From Phase 1 baseline:
- 65% PATH_HALLUCINATION → path fact must be FIRST, bold, session-start trigger
- 60% git confusion → co-locate with path fact (cascade pattern)
- 40% npx misuse → group with tool commands under tool-use trigger
- 30% verify slippage → separate BEFORE FINISH section with salience

## Measurement Plan

Starting now: audit next 20 tech-lead sessions using same protocol as Phase 1.
Decision rule: ≥40% drop in violation rate = confirmed.

## Revert Plan

Original context.md backed up in this file below. Revert if violation rate increases.

---

## Original context.md (backup)

```markdown
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
- agents/skills/decompose-before-acting.md - plan and verify complex multi-step tasks

## Shared Toolkit
See agents/shared/README-shared-toolkit.md.
```
