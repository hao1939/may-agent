#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  acceptedPublicationCommits,
  validatePublicationRange,
} from "../agents/owner/workflows/non-spec-main-publication.js";

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? "").trim() : "";
}

function git(...args: string[]): string {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 120_000,
  }).trim();
}

const candidate = argument("--candidate");
const taskStart = argument("--task-start");
const taskVerification = argument("--task-verification");
const acceptedFile = argument("--accepted-file");
if (!candidate || !taskStart || !taskVerification) {
  console.error(
    "usage: bun scripts/validate-app-publication-range.ts --candidate <commit> --task-start <pre-task-commit> --task-verification <evidence> [--accepted-file <json>]",
  );
  process.exit(2);
}

// The remote-tracking ref is authority only after this fetch completes.
git("fetch", "origin", "main");
const baseCommit = git("rev-parse", "origin/main");
const candidateCommit = git("rev-parse", candidate);
const taskStartCommit = git("rev-parse", taskStart);
const acceptedCommits = acceptedFile
  ? acceptedPublicationCommits(
      JSON.parse(readFileSync(resolve(acceptedFile), "utf8")),
    )
  : [];
const result = validatePublicationRange({
  cwd: process.cwd(),
  baseCommit,
  candidateCommit,
  taskStartCommit,
  currentTaskEvidence: [taskVerification],
  acceptedCommits,
});

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
