# Skill: Detect Missing Prerequisites

When a task requires input files, data sources, or dependencies that should already exist — verify they exist **before** doing any processing work. If a required input is missing, do NOT fabricate it or proceed without it.

## The Pattern

1. **Read the task requirements** — identify what input files/data the task depends on
2. **Verify prerequisites exist** — try to read/access each required input before doing work
3. **If missing: STOP and report** — finish with `status: "blocked"` or `status: "partial"`, clearly naming what's missing and why you can't proceed
4. **Never fabricate data** — if a file should have been produced by another process and it doesn't exist, that's a real gap. Creating fake data hides the problem.

## Examples

### Good: Prerequisite missing → block immediately
```
Task: "Generate report from etl-output.json"
→ Try to read etl-output.json
→ File not found
→ finish(status: "blocked", blockers: ["etl-output.json does not exist — required input from nightly ETL job is missing"])
```

### Good: Prerequisite exists → proceed normally
```
Task: "Parse results from test-output.log"
→ Read test-output.log → file exists, 200 lines
→ Parse and generate report
→ finish(status: "success")
```

### Bad: Fabricating missing data
```
Task: "Generate report from etl-output.json"  
→ File not found
→ Create etl-output.json with made-up records ← WRONG
→ Generate report from fake data ← WRONG
→ finish(status: "success") ← WRONG — the report is meaningless
```

## Why This Matters

When you fabricate missing inputs, you produce deliverables that look correct but contain fictional data. The person reviewing your work will assume the data is real. This is worse than reporting "blocked" — it creates silent failures downstream.

The right response to missing prerequisites is always: detect, declare, block.
