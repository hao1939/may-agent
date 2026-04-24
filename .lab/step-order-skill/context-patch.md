# Context Patch: Step Order Skill (read-all-inputs-first)

## Change Description
Add a "read-all-inputs-first" skill that instructs the agent to read ALL input files mentioned in a task before writing ANY output files (including checklists/plans).

## Rationale
In spec-adherence-multi-step-ext, the injected_context instructs the agent to write a CHECKLIST.md before starting work. The checklist template includes text like "Write audit-report.md", which triggers the step-order checker's `write.*audit-report` regex on the raw transcript. Since this write happens before the agent reads `server-config.json`, the order check fails.

Root cause: the checker uses raw transcript text search, and the CHECKLIST.md write contains "audit-report" in its content, matching `write.*audit-report` before `read.*server-config` appears in the transcript.

## Fix Mechanism
The skill instructs the agent to read all input files BEFORE writing anything, including checklists. This ensures `read("server-config.json")` appears in the transcript before any `write` call that could match `audit-report`.

## Test Scenario
- Primary: spec-adherence-multi-step-ext (baseline 0/3 on step-order, target 3/3)

## Fork Type
Skill injection — new behavioral skill
