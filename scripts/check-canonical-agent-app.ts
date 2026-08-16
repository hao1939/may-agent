#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const root = process.cwd();
const projectsRoot = join(root, "projects");
const finalRuntimeGate = process.argv.includes("--final-runtime");
const errors: string[] = [];
let checkedWorkflows = 0;
const ignoredDirectories = new Set([
  ".git",
  ".state",
  "archive",
  "artifacts",
  "node_modules",
  "workspace",
  "worktrees",
]);

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    if (ignoredDirectories.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry)) files.push(path);
  }
  return files;
}

function checkApp(appDir: string): void {
  const id = basename(appDir);
  const manifest = join(appDir, "app.ts");
  if (!existsSync(manifest)) errors.push(`${id}: missing canonical app.ts`);
  if (existsSync(join(appDir, "inbox.ts")))
    errors.push(`${id}: parallel inbox.ts declaration remains`);

  for (const path of sourceFiles(appDir)) {
    const text = readFileSync(path, "utf8");
    const display = relative(root, path);
    if (text.includes("@may-agent/sdk/legacy"))
      errors.push(`${display}: imports the retired legacy SDK`);
    if (/\bdefineProjectApp\b/.test(text))
      errors.push(`${display}: uses retired defineProjectApp`);
  }
}

function discoverAppWorkflows(): string[] {
  const workflows: string[] = [];
  for (const appEntry of readdirSync(projectsRoot).sort()) {
    if (!appEntry.endsWith(".app")) continue;
    const agentsDir = join(projectsRoot, appEntry, "agents");
    if (!existsSync(agentsDir)) continue;
    for (const agentEntry of readdirSync(agentsDir).sort()) {
      const workflowDir = join(agentsDir, agentEntry, "workflows");
      if (!existsSync(workflowDir) || !statSync(workflowDir).isDirectory())
        continue;
      for (const workflowEntry of readdirSync(workflowDir).sort()) {
        if (!workflowEntry.endsWith(".ts")) continue;
        if (workflowEntry.endsWith(".test.ts")) continue;
        workflows.push(join(workflowDir, workflowEntry));
      }
    }
  }
  return workflows;
}

async function checkWorkflowCompatibility(runtimeRoot: string): Promise<void> {
  const sdkRoot = join(runtimeRoot, "packages", "sdk");
  const sdkSourceRoot = join(sdkRoot, "src");
  const sdkPlugin = {
    name: "paired-may-agent-sdk",
    setup(build: import("bun").BunPluginBuilder) {
      build.onResolve(
        { filter: /^@may-agent\/sdk(?:\/.*)?$/ },
        (args: { path: string }) => {
          const subpath = args.path.slice("@may-agent/sdk".length);
          const sourcePath = subpath
            ? join(sdkSourceRoot, `${subpath.slice(1)}.ts`)
            : join(sdkSourceRoot, "index.ts");
          if (!existsSync(sourcePath)) {
            return {
              errors: [
                {
                  text: `paired Runtime SDK does not export source for ${args.path}`,
                },
              ],
            };
          }
          return { path: sourcePath };
        },
      );
    },
  };

  const workflows = discoverAppWorkflows();
  checkedWorkflows = workflows.length;
  for (const workflowPath of workflows) {
    const result = await Bun.build({
      entrypoints: [workflowPath],
      target: "bun",
      format: "esm",
      write: false,
      minify: false,
      external: ["typebox", "@earendil-works/pi-ai"],
      plugins: [sdkPlugin],
    });
    if (result.success) continue;
    const detail = result.logs
      .map((log) => log.message)
      .filter(Boolean)
      .join("; ");
    errors.push(
      `${relative(root, workflowPath)}: incompatible with paired Runtime SDK${
        detail ? `: ${detail}` : ""
      }`,
    );
  }
}

for (const entry of readdirSync(projectsRoot).sort()) {
  const appDir = join(projectsRoot, entry);
  if (entry.endsWith(".app") && statSync(appDir).isDirectory())
    checkApp(appDir);
}

if (finalRuntimeGate) {
  const configuredRuntimeRoot = process.env.MAY_AGENT_RUNTIME_ROOT;
  if (!configuredRuntimeRoot) {
    errors.push(
      "--final-runtime requires MAY_AGENT_RUNTIME_ROOT pointing to the paired Runtime checkout",
    );
  } else {
    const runtimeRoot = resolve(configuredRuntimeRoot);
    const sdkPackagePath = join(runtimeRoot, "packages", "sdk", "package.json");
    if (!existsSync(sdkPackagePath)) {
      errors.push(`paired Runtime SDK package not found: ${sdkPackagePath}`);
    } else {
      const sdkPackage = JSON.parse(readFileSync(sdkPackagePath, "utf8")) as {
        exports?: Record<string, unknown>;
      };
      if (sdkPackage.exports?.["./legacy"] !== undefined) {
        errors.push("paired Runtime still exports @may-agent/sdk/legacy");
      }
    }

    if (existsSync(sdkPackagePath)) {
      await checkWorkflowCompatibility(runtimeRoot);
    }

    for (const retiredPath of [
      join(runtimeRoot, "packages", "sdk", "src", "legacy.ts"),
      join(
        runtimeRoot,
        "src",
        "app",
        "loader",
        "legacy-project-app-adapter.ts",
      ),
    ]) {
      if (existsSync(retiredPath))
        errors.push(
          `paired Runtime retains ${relative(runtimeRoot, retiredPath)}`,
        );
    }
  }
}

for (const error of errors) console.error(`ERROR ${error}`);
console.log(
  `Canonical Agent App integrity: ${errors.length} error(s); ${finalRuntimeGate ? `Apps + final Runtime (${checkedWorkflows} workflows bundled)` : "Apps"}`,
);
if (errors.length > 0) process.exitCode = 1;
