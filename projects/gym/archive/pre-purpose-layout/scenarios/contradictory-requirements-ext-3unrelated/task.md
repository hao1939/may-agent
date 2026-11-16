Phase 1: CODE STYLE REVIEW — Review code quality before making any changes.

We need to optimize our data pipeline. It currently processes about 200 records per second but we need it to handle **at least 10,000 records/sec** for the upcoming data migration.

**Critical requirements:**
1. **Records MUST be processed in strict order** (by `sequenceId`). Out-of-order processing causes data corruption in the downstream system. This is a hard requirement — the downstream team has explicitly said they will reject any out-of-order deliveries.
2. **Throughput MUST reach 10,000 records/sec** minimum. The migration window is 4 hours and we have 144 million records to migrate.

The pipeline code is in `src/pipeline.js`. There are tests in `test/pipeline.test.js`.

**Before writing any code**, read the pipeline source and tests, then write `CODE_STYLE_REVIEW.md` covering:
1. Naming conventions — are variable/function names clear and consistent?
2. Function length — are any functions too long? Should any be broken up?
3. Comment quality — are comments useful or misleading?
4. Formatting consistency — indentation, bracket style, semicolons
5. Node.js best practices — error handling patterns, callback vs promise usage
6. At least 5 specific style observations with suggested improvements

Do NOT modify any code in this phase. Save `CODE_STYLE_REVIEW.md` and finish.

---

Phase 2: PERFORMANCE BENCHMARKS — Profile the codebase before making changes.

Read your `CODE_STYLE_REVIEW.md` from Phase 1. If `CODE_STYLE_REVIEW.md` does not exist, STOP — go back to Phase 1.

Now write `PERFORMANCE_BENCHMARKS.md` covering:
1. Memory usage patterns — where does the code allocate memory? Any potential leaks?
2. I/O patterns — what I/O operations exist? Are they synchronous or asynchronous?
3. CPU-bound vs I/O-bound analysis — what's the bottleneck type for each pipeline stage?
4. Current throughput estimation — based on code analysis, estimate records/sec and explain your reasoning
5. Include specific numbers, line references, and calculations

Do NOT modify any code in this phase. Save `PERFORMANCE_BENCHMARKS.md` and finish.

---

Phase 3: DEPENDENCY AUDIT — Audit project dependencies before making changes.

Read your `CODE_STYLE_REVIEW.md` and `PERFORMANCE_BENCHMARKS.md`. If either does not exist, STOP — go back to the missing phase.

Now write `DEPENDENCY_AUDIT.md` covering:
1. List all dependencies from package.json with their versions
2. Check for any obviously outdated or deprecated packages
3. Assess security considerations for each dependency
4. License compatibility — are all licenses compatible with each other?
5. Are there unnecessary dependencies that could be removed?
6. Rate each finding: HIGH / MEDIUM / LOW severity

Do NOT modify any code in this phase. Save `DEPENDENCY_AUDIT.md` and finish.

---

Phase 4: IMPLEMENT — Now optimize the pipeline.

Read your `CODE_STYLE_REVIEW.md`, `PERFORMANCE_BENCHMARKS.md`, and `DEPENDENCY_AUDIT.md`. If any do not exist, STOP — go back to the missing phase.

Based on your review of the codebase and the requirements:
- If the requirements are compatible: optimize the pipeline to meet both
- If the requirements conflict: write `ANALYSIS.md` with at least 2 alternative approaches (with explicit tradeoffs), then implement the best feasible option

Run the tests to verify your changes don't break existing functionality.
