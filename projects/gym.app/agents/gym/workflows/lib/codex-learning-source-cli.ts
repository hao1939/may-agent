#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { scanCodexLearningSource } from "./codex-learning-source";

interface Checkpoint {
  processed_source_ids?: unknown;
}

const [codexHome, checkpointPath, outputPath] = process.argv.slice(2);
if (!codexHome || !checkpointPath || !outputPath) {
  throw new Error(
    "usage: codex-learning-source-cli <codex-home> <checkpoint> <output>",
  );
}

const checkpoint = existsSync(checkpointPath)
  ? (JSON.parse(readFileSync(checkpointPath, "utf8")) as Checkpoint)
  : {};
const processed = Array.isArray(checkpoint.processed_source_ids)
  ? checkpoint.processed_source_ids.map(String)
  : [];
const scan = await scanCodexLearningSource({
  codexHome,
  processedSourceIds: processed,
});
writeFileSync(outputPath, `${JSON.stringify(scan)}\n`);
console.log(
  JSON.stringify({
    totalHistoryRows: scan.totalHistoryRows,
    newHistoryRows: scan.newHistoryRows,
    rolloutFilesRead: scan.rolloutFilesRead,
    malformedLines: scan.malformedLines,
  }),
);
