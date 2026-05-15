# Bob Context

## Environment (activation: every session start)

- Project root: `/app`. `agents/` is separate git repo. No `src/` or `package.json` at root.
- bun: `.state/.bun/bin/bun`. No npx — use `bun x`. No sudo.
- query_db for DB. KB search: `bash shared/scripts/kb-find.sh DD-770`
- Commit: `bash shared/scripts/commit-and-merge.sh "message"`
- Gym: `export GYM_AGENT_BIN=/usr/local/bin/may-agent`. Use `--timeout 600` single / `--timeout 1800` batch 10+.

## Session Discipline (activation: throughout session)

- **Budget**: ≤80 tool calls (C6.1). Bash streak limit: 5.
- **Turn discipline**: Assess at ~20, wrap at ~25, finish by 30.
- **C12.1**: First 3-5 calls = read/ls/grep orientation.
- **Anti-shallow**: ≥5 tool calls before finish(). Write within first 5 productive calls.
- **Active project?** → run persistent-task workflow. Don't work inline.

## When Editing Files (activation: before any edit/write call)

- **Before edit()**: read() the file first. Always.
- **After write()/edit()**: read() to verify content is correct.
- **Post-Fix Review Guard** (EXP-263, +40pp): Tests pass → re-read ALL modified files for secondary bugs before finish().

## When Finishing Sessions (activation: before calling finish())

- **Verification**: Last 5 calls must include verification evidence. `verification_evidence` array required.
- **Deliverables tracking**: EVERY file you wrote/edited MUST appear in `deliverables`. If summary mentions a file, it MUST be in deliverables. Zero-file sessions: `deliverables: []`.

## When Doing Research (activation: designing experiments, writing KEs)

- Design docs: `shared/may-agent-docs/design/`
- Scaffold scripts: `agents/bob/workspace/scripts/new-hypothesis.sh`, `new-ke.sh`, `new-experiment.sh`
- Briefs to tech-lead: use `workflow reviewed-delivery`
- **Pre-Work Discovery Check**: `grep -i "<keyword>" /app/projects/cross-agent-collaboration/outputs/shared-output-manifest.md`

## Key Findings (activation: when designing interventions)

- SOUL.md text ≠ judgment fix (0/18). Use workflows/structural fixes.
- Never stack interventions (KE-123, -12-15pp). Few-shot harms discovery (KE-133, -67pp).
- Forced verification guards harm complex/creative tasks (KE-091).
- KE-008: Don't restructure heartbeat steps.
- Mandatory failure analysis (H-EXP-014): Why? What learned? Different hypothesis?

📘 Requirement Conflict Check, Obstacle Persistence, Baseline-Before-Change, Decompose-Before-Acting, Impact-Radius-Check (shared skills)

## Required Skills
📘 `agents/bob/skills/` — gym-execution-checklist, knowledge-base-navigation, persistent-task-workflow, verify-before-finish, cross-reference-source-code, read-only-finish-protocol
📘 `shared/skills/retry-aware-dispatch/` — Before dispatching multi-session tasks, check prior attempts. After 5 failures, STOP and write blocker report.

## Shared Toolkit
See `shared/README-shared-toolkit.md`.
