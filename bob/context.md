# Bob Context

## ⚡ [SESSION START]

**Environment:**
- Project root: /app. agents/ is separate git repo. No src/ or package.json at root.
- bun: `.state/.bun/bin/bun`. No npx — use `bun x`. No sudo.
- query_db for DB. KB search: `bash agents/shared/scripts/kb-find.sh DD-770`
- Commit: `bash agents/shared/scripts/commit-and-merge.sh "message"`
- Gym: `export GYM_AGENT_BIN=/usr/local/bin/may-agent`. Use `--timeout 600` single / `--timeout 1800` batch 10+.

**Project resumption:** Active project → run persistent-task workflow. Don't work inline.
**Turn discipline**: Assess at ~20, wrap at ~25, finish by 30.

## ⛔ MANDATORY PROTOCOLS
- **Before edit()**: read() the file first. Always.
- **After write()/edit()**: read() to verify.
- **Before finish(success)**: verification in last 5 calls. `verification_evidence` array required.
- **C12.1**: First 3-5 calls = read/ls/grep.
- **Anti-shallow**: ≥5 tool calls before finish(). **Write within 5** calls.
- Budget: ≤80 tool calls (C6.1). Bash streak limit: 5.

## Research Workflow
- Design docs: `agents/shared/may-agent-docs/design/`
- Scaffold scripts: `agents/bob/workspace/scripts/new-hypothesis.sh`, `new-ke.sh`, `new-experiment.sh`
- Briefs to tech-lead: use `workflow reviewed-delivery`

## Key Findings
- SOUL.md text ≠ judgment fix (0/18). Use workflows/structural fixes.
- Never stack interventions (KE-123, -12-15pp). Few-shot harms discovery (KE-133, -67pp).
- Forced verification guards harm complex/creative tasks (KE-091).
- KE-008: Don't restructure heartbeat steps.
- Mandatory failure analysis (H-EXP-014): Why? What learned? Different hypothesis?

## ⛔ Post-Fix Review Guard (EXP-263, +40pp)
Tests pass → re-read ALL modified files for secondary bugs before finish().

📘 **Requirement Conflict Check (EXP-345, +67pp)**: LIST constraints, DO THE MATH, STOP if conflicts.
📘 **Obstacle Pivot**: `agents/shared/skills/obstacle-pivot/SKILL.md` (+100pp EXP-084)
📘 **Baseline-Before-Change**: `agents/shared/skills/baseline-before-change/SKILL.md`

## Required Skills
📘 `agents/bob/skills/evidence-over-narrative.md`, `gym-execution-checklist.md`, `knowledge-base-navigation.md`
📘 `agents/bob/skills/persistent-task-workflow.md`, `read-before-edit.md`, `verify-before-finish.md`
📘 `agents/bob/skills/cross-reference-source-code.md`, `read-only-finish-protocol.md`

## Hao's Preferences
Stability-first, guards stay strong, quality>quantity, observability, knowledge APPLIED.

## Shared Toolkit
See `agents/shared/README-shared-toolkit.md`.

[SIG: 1777642137:bd5d900d]
