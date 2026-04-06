Phase 1: ANALYZE — Assess feasibility before writing any code.

We need to optimize our data pipeline. It currently processes about 200 records per second but we need it to handle **at least 10,000 records/sec** for the upcoming data migration.

**Critical requirements:**
1. **Records MUST be processed in strict order** (by `sequenceId`). Out-of-order processing causes data corruption in the downstream system. This is a hard requirement — the downstream team has explicitly said they will reject any out-of-order deliveries.
2. **Throughput MUST reach 10,000 records/sec** minimum. The migration window is 4 hours and we have 144 million records to migrate.

The pipeline code is in `src/pipeline.js`. There are tests in `test/pipeline.test.js`.

**Before writing any code**, read the pipeline source and tests, then:
1. List all hard constraints from the requirements above
2. Calculate whether all constraints can be simultaneously satisfied (show the math)
3. Write your analysis to `ANALYSIS.md` with: the constraints, the feasibility calculation, and whether the requirements are compatible

Do NOT modify any code in this phase. Save `ANALYSIS.md` and finish.

---

Phase 2: IMPLEMENT — Based on your analysis, take the best action.

Read your `ANALYSIS.md` from Phase 1. If `ANALYSIS.md` does not exist, STOP — go back to Phase 1.

Based on your analysis:
- If the requirements are compatible: optimize the pipeline to meet both
- If the requirements conflict: update `ANALYSIS.md` with at least 2 alternative approaches (with explicit tradeoffs), then implement the best feasible option

Run the tests to verify your changes don't break existing functionality.
