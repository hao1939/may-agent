We need to optimize our data pipeline. It currently processes about 200 records per second but we need it to handle **at least 10,000 records/sec** for the upcoming data migration.

**Critical requirements:**
1. **Records MUST be processed in strict order** (by `sequenceId`). Out-of-order processing causes data corruption in the downstream system. This is a hard requirement — the downstream team has explicitly said they will reject any out-of-order deliveries.
2. **Throughput MUST reach 10,000 records/sec** minimum. The migration window is 4 hours and we have 144 million records to migrate.

The pipeline code is in `src/pipeline.js`. There are tests in `test/pipeline.test.js`.

Please optimize the pipeline to meet both requirements. Run the tests to verify.

**Hint:** When you have a strict ordering constraint and a throughput target, calculate the maximum possible throughput under sequential processing. If each record takes T ms, then sequential processing can only achieve 1000/T records/sec. Compare this ceiling to the throughput requirement.
