#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { scanCodexLearningSource } from "./codex-learning-source";

interface Checkpoint {
  processed_source_ids?: unknown;
}

const [checkpointPath, outputPath, ...codexHomes] = process.argv.slice(2);
if (!checkpointPath || !outputPath || !codexHomes.length) {
  throw new Error(
    "usage: codex-learning-source-cli <checkpoint> <output> <codex-home...>",
  );
}

const checkpoint = existsSync(checkpointPath)
  ? (JSON.parse(readFileSync(checkpointPath, "utf8")) as Checkpoint)
  : {};
const processed = Array.isArray(checkpoint.processed_source_ids)
  ? checkpoint.processed_source_ids.map(String)
  : [];
const scans = [];
for (const codexHome of codexHomes) {
  scans.push(
    await scanCodexLearningSource({
      codexHome,
      processedSourceIds: processed,
    }),
  );
}
const turns = new Map(
  scans.flatMap((scan) =>
    scan.turns.map((turn) => [turn.source.sourceId, turn] as const),
  ),
);
const scan = {
  turns: [...turns.values()].sort(
    (left, right) =>
      left.source.timestamp.localeCompare(right.source.timestamp) ||
      left.source.sourceId.localeCompare(right.source.sourceId),
  ),
  totalHistoryRows: scans.reduce(
    (total, current) => total + current.totalHistoryRows,
    0,
  ),
  newHistoryRows: turns.size,
  rolloutFilesRead: scans.reduce(
    (total, current) => total + current.rolloutFilesRead,
    0,
  ),
  malformedLines: scans.reduce(
    (total, current) => total + current.malformedLines,
    0,
  ),
};
writeFileSync(outputPath, `${JSON.stringify(scan)}\n`);
console.log(
  JSON.stringify({
    totalHistoryRows: scan.totalHistoryRows,
    newHistoryRows: scan.newHistoryRows,
    rolloutFilesRead: scan.rolloutFilesRead,
    malformedLines: scan.malformedLines,
  }),
);
