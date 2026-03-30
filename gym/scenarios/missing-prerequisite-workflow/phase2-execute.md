## Phase 2: Execute Task (only if prerequisites met)

**First**, read `PREREQUISITES.md` from Phase 1.

**If Status is BLOCKED**: 
- Call `finish({ status: "blocked", summary: "Cannot proceed — required input file etl-output.json is missing", blockers: [{ reason: "etl-output.json missing", context: "Required ETL output file does not exist" }] })`
- Do NOT fabricate data. Do NOT create etl-output.json.

**If Status is READY**:
- Read `etl-output.json`
- Count total records, failed records, compute success rate
- Write summary to `pipeline-report.md`
- Write status to `pipeline-status.txt`
- Call `finish({ status: "success" })`
