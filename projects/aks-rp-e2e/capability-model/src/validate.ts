import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { summarizeCapabilityModel, validateCapabilityModel, type CapabilityModel } from "./index.js";

const modelPath = process.argv[2];
if (!modelPath) {
  console.error("usage: bun src/validate.ts <capability-model.json>");
  process.exit(2);
}

const absolutePath = resolve(process.cwd(), modelPath);
const model = JSON.parse(readFileSync(absolutePath, "utf8")) as CapabilityModel;
const validation = validateCapabilityModel(model);

for (const issue of validation.issues) {
  const prefix = issue.severity === "error" ? "ERROR" : "WARN";
  console.log(`${prefix} ${issue.code}${issue.path ? ` ${issue.path}` : ""}: ${issue.message}`);
}

if (!validation.valid) process.exit(1);

const summary = summarizeCapabilityModel(model);
console.log(JSON.stringify(summary, null, 2));
