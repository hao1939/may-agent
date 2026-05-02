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
- **Deliverables tracking**: EVERY file you wrote/edited MUST appear in finish() `deliverables`. If summary mentions a file, it MUST be in deliverables. Zero-file sessions: `deliverables: []`.
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

📘 Requirement Conflict Check, Obstacle Persistence, Baseline-Before-Change, Decompose-Before-Acting, Impact-Radius-Check (shared skills)

## Required Skills
📘 `agents/bob/skills/` — gym-execution-checklist, knowledge-base-navigation, persistent-task-workflow, verify-before-finish, cross-reference-source-code, read-only-finish-protocol

## Shared Toolkit
See `agents/shared/README-shared-toolkit.md`.


## Pre-Work Discovery Check
Before starting new work, check for existing deliverables:
```bash
grep -i "<keyword>" /app/agents/shared/projects/cross-agent-collaboration/outputs/shared-output-manifest.md
```
If a related output exists, read it first to avoid duplicating work.
