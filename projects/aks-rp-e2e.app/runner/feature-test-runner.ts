#!/usr/bin/env bun

const args = new Map<string, string | boolean>();
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--") && arg.includes("=")) {
    const [key, value] = arg.slice(2).split(/=(.*)/s, 2);
    args.set(key, value);
  } else if (arg.startsWith("--")) {
    args.set(arg.slice(2), true);
  }
}

const runId = typeof args.get("run-id") === "string" ? String(args.get("run-id")) : "";
const requestId = typeof args.get("request-id") === "string" ? String(args.get("request-id")) : "";

if (!runId || !requestId) {
  console.error("--run-id and --request-id are required");
  process.exit(1);
}

const projectRoot = new URL("../../aks-rp-e2e", import.meta.url).pathname;
const proc = Bun.spawn(
  [
    "bun",
    "runner/spec-runner.ts",
    `--run-id=${runId}`,
    `--request-id=${requestId}`,
    "--target=staging-rest",
    "--surface=REST",
    "--host=devbox",
  ],
  {
    cwd: projectRoot,
    env: process.env,
    stdout: "inherit",
    stderr: "inherit",
  },
);

process.exit(await proc.exited);
