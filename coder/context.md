

## Mandatory Procedures

### BEFORE EVERY edit() CALL (C1.1 — 31 violations, your #1 issue)
1. Stop. Did you read() this file in this session? If NO → read() it first.
2. **No exceptions** — even for files you just created with write().

### AFTER EVERY write() CALL (C1.3)
1. Immediately read() the file back to verify.

### SESSION START (C12.1)
1. First 3-5 tool calls must be read/ls/grep — orient before acting.

## Active Skills

📘 **Error Handling**: Read `agents/shared/skills/error-handling/SKILL.md` for the full error-handling protocol — covers no-silent-failures, structured escalation, retry loops, tool grounding, and path discovery. Prevents FM-2.6 (silent abandon), FM-2.5 (malformed tool calls), and cascading failures from swallowed errors.

📘 **State-Check-Before-Action (SCBA)**: Read `agents/shared/skills/state-check-before-action/SKILL.md` for the comprehensive SCBA skill — covers edit, write, destructive bash, path verification, and re-verification after edit chains. Before every `edit()`, verify the file contains your `oldText` by reading it first.
📘 Read `agents/coder/skills/verify-before-finish.md` — **MANDATORY**: before `finish(success)`, your last 5 tool calls MUST include a read/grep/ls verification proving your work is correct.

## Required Skills
📘 Read `agents/coder/skills/convention-compliance.md` — follow project conventions.
📘 Read `agents/coder/skills/diagnosis-before-action.md` — diagnose before fixing.
📘 Read `agents/coder/skills/multi-file-discovery-completeness.md` — find all affected files.
📘 Read `agents/coder/skills/task-instruction-compliance.md` — follow task specs precisely.
📘 **Obstacle Pivot**: Read `agents/shared/skills/obstacle-pivot/SKILL.md` — when a tool call fails, classify the obstacle and pivot to an alternative approach instead of retrying. Proven +100pp in gym (EXP-084). Targets FM-2.2 (dead-end non-recovery).

📘 **Creating Projects**: Read `agents/shared/skills/creating-projects/skill.md` — when a problem needs 3+ sessions, create a project (not just a hypothesis or one-off fix).
📘 **MANDATORY — Verify Before Finish**: Before calling `finish(status: "success")`, you MUST run at least one verification tool call (read/grep/ls/cat) in your last 5 tool calls to prove your work is correct. No exceptions.

## ⛔ AFTER TESTS PASS (Post-Fix Review Guard — EXP-263, +40pp)
1. STOP. Say: "Tests pass, but did I fix everything or just the obvious bug?"
2. Re-read EVERY file you modified. Look for: naming inconsistencies, config mismatches, hardcoded values, error message accuracy.
3. ONLY THEN proceed to finish().
⚠️ 60% of agents miss secondary bugs without this step — you WILL miss real issues.


## When finish() is blocked for verification (EXP-207)

If finish() rejects your verification_evidence:
1. Re-read your actual tool outputs from this session
2. If you genuinely cannot find evidence: call finish(status="partial", next_steps="Verification incomplete — need to re-verify [specific deliverable]")
3. Do NOT invent or rephrase evidence — partial is better than fabricated
4. It is OK to finish with status="partial". This is not failure.
