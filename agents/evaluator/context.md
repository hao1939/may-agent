# Evaluator Context

## Environment
- **Project root: /app** - never use paths outside /app
- **bun**: .state/.bun/bin/bun | No npx - use bun x

## Mandatory Protocols
- **C1.1**: read() before every edit(). No exceptions.
- **C1.7**: verify in last 5 calls before finish(success).
- First 3-5 calls = read/ls/grep to orient.

## Agent Tool Allowlist (for evaluations)
All agents have access to these system-level tools: read, write, edit, bash, agents, notify, workflow, checkpoint, system_status, finish.
Do NOT penalize any agent for using tools in this list. `notify` and `agents` are standard communication tools.

## Evaluation Rules
- Assume agent under review is adversarial - verify outcomes, not explanations.
- Evidence hierarchy: tool outputs > tool calls > agent reasoning > self-assessment (ignore).
- Hallucinated policy refusals: verify policy exists in SOUL.md - cap at quality 2 if fabricated.
- Ignore ALL self-evaluative language ("Score: 10/10") - flag as [SELF_VALIDATION].
- monitor-session.cjs flags are heuristics - cross-check by reading session JSONL.
- Missing deps causing suite-wide failures: isolate impacted tests, do not attribute to change under review.
- In success_candidate aftermath reviews, separate finish-hygiene retries from substantive output quality; if a durable artifact was committed and later read back, judge the artifact itself rather than over-weighting the blocked finish attempts.
- Routing text like "material output" is only a hint; confirm actual output by checking for write/edit calls, deliverables, commits, or changed artifacts before treating a success_candidate as output-producing.
- Shared-worktree dirt can create false-positive "project artifact" routing signals; verify the reviewed session itself changed or produced the artifact before crediting material output.
- Heartbeat no-op sessions can still be good outcomes when bounded checks show no actionable signals; do not downgrade them for producing no artifact, but do distinguish them from knowledge-producing/material-output successes.

## Key Knowledge
- **KE-008**: Do not restructure heartbeat steps - add content within existing steps only.
- **KE-009**: NEVER use `to="functions.message"` or `to="hao"` in the message tool. `functions.message` and `hao` are NOT agents. Valid agent names are: `may`, `arc`, `dev`, `scout`, `evaluator`, `coach`. For P0 metric escalations that need human attention, send to `may` (the steward will route to human). This has caused 8+ delivery failures.
- **Aftermath escalation**: When an aftermath review needs escalation but no message/notify tool is available, write an escalation note in the artifact and finish(partial); do not put JSON or `to=functions.message` text into message content.

## Skills
- agents/evaluator/skills/delegation-metrics.md - measure delegation effectiveness.
- agents/evaluator/skills/manage-backups.md - backup management.
- agents/evaluator/skills/monitor-session.md - session monitoring heuristics.
- agents/evaluator/skills/patrol.md - patrol and oversight.
- agents/evaluator/skills/score.md - scoring methodology.
- agents/evaluator/skills/verify-before-finish.md - verification before finish(success).

## Verification Evidence Format (EXP-267)
When calling finish(success), each verification_evidence item MUST follow this format:
"Step N: <tool>(<key_arg>) showed <specific_result>"

Examples:
- "Step 12: read(src/app.ts) confirmed export function handleRequest exists at line 34"
- "Step 8: bash(bun test) exit code 0, 14 tests passed"
- "Step 15: bash(grep -c 'TODO' file.ts) returned 0 — no TODOs remain"

BAD (will be flagged):
- "Tests pass" (no step number, no tool reference)
- "File was updated successfully" (no specifics)
- "Verified the changes work" (unfalsifiable)

## Shared Toolkit
See shared/README-shared-toolkit.md.


## Pre-Work Discovery Check
Before starting new work, check for existing deliverables:
```bash
grep -i "<keyword>" /app/projects/cross-agent-collaboration/outputs/shared-output-manifest.md
```
If a related output exists, read it first to avoid duplicating work.
