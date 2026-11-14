import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

declare const Bun: {
  build(options: {
    entrypoints: string[];
    compile: { outfile: string };
    define: Record<string, string>;
  }): Promise<{ success: boolean; logs: unknown[] }>;
};

type PackageIdentity = { name: string; version: string };

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback;
}

function sourceCommit(): string {
  const configured = process.env.MAY_AGENT_BUILD_COMMIT?.trim() ?? "";
  if (/^[0-9a-f]{40}$/.test(configured)) return configured;
  try {
    const discovered = execFileSync("git", ["rev-parse", "--verify", "HEAD"], { encoding: "utf8" }).trim();
    if (/^[0-9a-f]{40}$/.test(discovered)) return discovered;
  } catch {
    // An exported source archive must provide MAY_AGENT_BUILD_COMMIT.
  }
  return "unknown";
}

const outfile = resolve(option("--outfile", "bundle/may-agent"));
const packageIdentity = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as PackageIdentity;
if (!packageIdentity.name?.trim() || !packageIdentity.version?.trim()) {
  throw new Error("package.json must declare a non-empty name and version");
}
mkdirSync(dirname(outfile), { recursive: true });
const result = await Bun.build({
  entrypoints: [resolve("src/app/binary-entry.ts")],
  compile: { outfile },
  define: {
    __MAY_AGENT_BUILD_COMMIT__: JSON.stringify(sourceCommit()),
  },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
