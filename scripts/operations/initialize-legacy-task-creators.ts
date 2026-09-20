#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { openDatabase } from "../../src/lib/db.js";
import {
  initializeLegacyTaskCreators,
  type LegacyTaskCreatorManifest,
} from "../../src/app/core/state/legacy-task-creator-initialization.js";

function usage(): never {
  throw new Error(
    "Usage: bun scripts/operations/initialize-legacy-task-creators.ts " +
      "--state-dir <stopped-host-state-dir> --manifest <private-manifest.json> " +
      "--confirm-host-and-workers-stopped [--dry-run]",
  );
}

const args = process.argv.slice(2);
const value = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const stateArg = value("--state-dir");
const manifestArg = value("--manifest");
if (!stateArg || !manifestArg || !args.includes("--confirm-host-and-workers-stopped")) usage();
const known = new Set([
  "--state-dir",
  stateArg,
  "--manifest",
  manifestArg,
  "--confirm-host-and-workers-stopped",
  "--dry-run",
]);
if (args.some((arg) => !known.has(arg))) usage();

const databasePath = join(resolve(stateArg), "may.db");
const manifestPath = resolve(manifestArg);
if (!existsSync(databasePath)) throw new Error(`Host database does not exist: ${databasePath}`);
if (!existsSync(manifestPath)) throw new Error(`Creator manifest does not exist: ${manifestPath}`);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as LegacyTaskCreatorManifest;

const db = openDatabase(databasePath);
try {
  db.exec("PRAGMA busy_timeout = 1000");
  db.exec("PRAGMA foreign_keys = ON");
  const result = initializeLegacyTaskCreators(db, manifest, {
    hostAndWorkersStopped: true,
    dryRun: args.includes("--dry-run"),
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  db.close();
}
