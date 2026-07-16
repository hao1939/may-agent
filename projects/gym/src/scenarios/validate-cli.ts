#!/usr/bin/env bun

import { resolve } from "node:path";

import { formatValidation, validateScenarioCorpus } from "./validate";

const scenariosDir = resolve(import.meta.dirname, "../../scenarios");
const result = validateScenarioCorpus(scenariosDir);
console.log(formatValidation(result, process.argv.includes("--verbose")));
if (!result.passed) process.exitCode = 1;

