#!/usr/bin/env bun
import { resolve } from "node:path";
import { legacyCasesDirectory } from "./catalog";
import { validateCaseCatalog } from "./validate";
import {
  formatValidation,
  validateScenarioCorpus,
} from "../scenarios/validate";

const root = resolve(import.meta.dirname, "../..");
if (process.argv.includes("--legacy")) {
  const result = validateScenarioCorpus(legacyCasesDirectory(root));
  console.log(
    `Archived compatibility corpus (not active benchmark coverage):\n${formatValidation(result, process.argv.includes("--verbose"))}`,
  );
  if (!result.passed) process.exitCode = 1;
} else {
  const result = validateCaseCatalog(root);
  console.log(
    `${result.passed ? "✓" : "✗"} ${result.cases} active cases in ${result.benchmarks} purpose benchmarks; ${result.issues.length} structural errors`,
  );
  for (const issue of result.issues) console.log(`  ${issue}`);
  if (!result.passed) process.exitCode = 1;
}
