#!/usr/bin/env bun
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const activeAppRoots = readdirSync("projects", { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      entry.name.endsWith(".app") &&
      !existsSync(join("projects", entry.name, ".disabled")) &&
      existsSync(join("projects", entry.name, "app.ts")),
  )
  .map((entry) => join("projects", entry.name));

const roots = ["shared", "agents", ...activeAppRoots];
const excluded = [
  /^node_modules\//,
  /^shared\/projects\//,
  /^agents\/shared\//,
  /^agents\/[^/]+\/workspace\//,
  /^projects\/[^/]+\/(?:archive|workspace|node_modules|\.state)\//,
  /^projects\/[^/]+\/agents\/[^/]+\/(?:archive|workspace|node_modules|\.state)\//,
  /^\.state\//,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "archive" ||
      entry.name === "workspace" ||
      entry.name === "node_modules" ||
      entry.name === ".state"
    )
      continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (entry.isFile() && entry.name.endsWith(".test.ts")) out.push(path);
  }
  return out;
}

const files = roots
  .flatMap((root) => walk(root))
  .map((file) => relative(process.cwd(), file).replaceAll("\\", "/"))
  .filter((file) => !excluded.some((pattern) => pattern.test(file)))
  .sort();

const localSitePackages = join(process.cwd(), ".state/.local/lib/python3.11/site-packages");
const env = {
  ...process.env,
  ...(existsSync(localSitePackages) && !process.env.PYTHONPATH?.includes(localSitePackages)
    ? { PYTHONPATH: [localSitePackages, process.env.PYTHONPATH].filter(Boolean).join(":") }
    : {}),
};

const chunkSize = Number(process.env.TEST_CHUNK_SIZE || 8);
let totalPass = 0;
let totalFiles = 0;
let totalExpect = 0;
const started = Date.now();

for (let i = 0; i < files.length; i += chunkSize) {
  const chunk = files.slice(i, i + chunkSize);
  const args = [
    "test",
    ...chunk.map((file) => `./${file}`),
    "--timeout",
    "45000",
  ];
  const result = spawnSync("bun", args, {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
    env,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if ((result.status ?? 1) !== 0) {
    process.stdout.write(output);
    process.exit(result.status ?? 1);
  }

  const passMatch = output.match(/\n\s*(\d+)\s+pass\b/);
  const expectMatch = output.match(/\n\s*(\d+)\s+expect\(\) calls\b/);
  const filesMatch = output.match(
    /Ran\s+\d+\s+tests\s+across\s+(\d+)\s+files?/,
  );
  totalPass += passMatch ? Number(passMatch[1]) : 0;
  totalExpect += expectMatch ? Number(expectMatch[1]) : 0;
  totalFiles += filesMatch ? Number(filesMatch[1]) : chunk.length;
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`${totalPass} pass`);
console.log(`${totalExpect} expect() calls`);
console.log(
  `Ran default app health tests across ${totalFiles} files in ${seconds}s`,
);
process.exit(0);
