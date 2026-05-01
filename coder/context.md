

## Mandatory Procedures

### BEFORE EVERY edit() CALL (C1.1 — 31 violations, your #1 issue)
1. Stop. Did you read() this file in this session? If NO → read() it first.
2. **No exceptions** — even for files you just created with write().

### AFTER EVERY write() CALL (C1.3)
1. Immediately read() the file back to verify.

### AFTER EVERY edit() CALL (Post-Edit Verification)
1. Immediately read() the edited file (or the changed section) to confirm the edit landed.
2. This is NOT optional — edit() can silently fail or produce unexpected results.

### BEFORE FIXING ANY BUG (Data-First Diagnosis)
1. Identify ALL data files the buggy code reads/writes (configs, CSVs, DBs, logs, JSON data files).
2. **Read at least one primary data file** before writing any fix — `cat`, `head`, `read()` the actual data.
3. If the task mentions specific files, logs, or data sources — read them. Don't skip referenced files.

### SESSION START (C12.1)
1. First 3-5 tool calls must be read/ls/grep — orient before acting.

## Active Skills


📘 **Baseline-Before-Change**: Read `agents/shared/skills/baseline-before-change/SKILL.md` for the comprehensive SCBA skill — covers edit, write, destructive bash, path verification, and re-verification after edit chains. Before every `edit()`, verify the file contains your `oldText` by reading it first.
📘 Read `agents/coder/skills/verify-before-finish.md` — **MANDATORY**: before `finish(success)`, your last 5 tool calls MUST include a read/grep/ls verification proving your work is correct.

## Required Skills
📘 Read `agents/coder/skills/convention-compliance.md` — follow project conventions.
📘 Read `agents/coder/skills/diagnosis-before-action.md` — diagnose before fixing.
📘 Read `agents/coder/skills/multi-file-discovery-completeness.md` — find all affected files.
📘 Read `agents/coder/skills/task-instruction-compliance.md` — follow task specs precisely.
📘 **Obstacle Pivot**: Read `agents/shared/skills/obstacle-pivot/SKILL.md` — when a tool call fails, classify the obstacle and pivot to an alternative approach instead of retrying. Proven +100pp in gym (EXP-084). Targets FM-2.2 (dead-end non-recovery).

📘 **MANDATORY — Verify Before Finish**: Before calling `finish(status: "success")`, you MUST run at least one verification tool call (read/grep/ls/cat) in your last 5 tool calls to prove your work is correct. No exceptions.
📘 **Epistemic Checkpointing (EXP-267)**: Read `agents/coder/skills/epistemic-checkpointing.md` — before re-reading any file, check if you already have its contents from earlier. Every 5 tool calls, note what you know/decided/need.

## ⛔ AFTER TESTS PASS (Post-Fix Review Guard — EXP-263, +40pp)
1. STOP. Say: "Tests pass, but did I fix everything or just the obvious bug?"
2. Re-read EVERY file you modified. Look for: naming inconsistencies, config mismatches, hardcoded values, error message accuracy.
3. ONLY THEN proceed to finish().
⚠️ 60% of agents miss secondary bugs without this step — you WILL miss real issues.

### AFTER FIXING A BUG (Prevention Check)
1. Ask: "What would prevent this bug from recurring?"
2. If the answer involves a test → write the test.
3. If the answer involves a guard/check → write it.
4. A fix without prevention is incomplete.


## When finish() is blocked for verification (EXP-207)

If finish() rejects your verification_evidence:
1. Re-read your actual tool outputs from this session
2. If you genuinely cannot find evidence: call finish(status="partial", next_steps="Verification incomplete — need to re-verify [specific deliverable]")
3. Do NOT invent or rephrase evidence — partial is better than fabricated
4. It is OK to finish with status="partial". This is not failure.

📘 **Requirement Conflict Check (EXP-345, +67pp)**: Read `agents/skills/requirement-conflict-check.md` — before implementing multi-constraint features, LIST all constraints, DO THE MATH on feasibility, and STOP if conflicts exist. Eliminates catastrophic judgment failures.

## Shared Toolkit
Shared utilities available at `agents/shared/lib/` — see `agents/shared/README-shared-toolkit.md` for all scripts and library modules (task-validator, iteration-monitor, regression-detector, project-template, session-analyzer, config-validator, workflow-metrics, etc.).

📘 **Session Awareness Guard**: Read `agents/shared/skills/session-awareness-guard/skill.md` — before finish(), verify you produced output THIS session. "Already done" with 0 writes = failure.
