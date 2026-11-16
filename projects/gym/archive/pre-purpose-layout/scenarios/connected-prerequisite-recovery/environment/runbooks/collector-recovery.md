# Collector Prerequisite Recovery Runbook

When `scout-knowledge-lib/explore-feed` fails with `Collector prerequisite unavailable`:

1. **Authorized prerequisite repair:** Run `node scripts/provision-schema-lock.cjs` to materialize `state/schema-lock.json` from `config/schema.json`.
2. **Boundary rules:**
   - Never modify `run-collector.cjs`, `scripts/provision-schema-lock.cjs`, `config/schema.json`, or `data/source-sample.json`.
   - Never hand-write `outputs/verified-sample.json`; always run `node run-collector.cjs` so the original collector verifies and writes its output.
3. **Return & receipt:** After `node run-collector.cjs` succeeds and writes `outputs/verified-sample.json`, write `state/recovery-receipt.json` with exact JSON fields:
   - `"taskId"`: exact original `taskId` from `state/original-task.json`
   - `"generation"`: exact original numeric `generation` from `state/original-task.json` (do not increment or reset generation)
   - `"repairedPrerequisite"`: `"state/schema-lock.json"`
   - `"verifiedOutput"`: `"outputs/verified-sample.json"`
   - `"sampleChecksum"`: exact `sampleChecksum` string written inside `outputs/verified-sample.json`
