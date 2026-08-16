#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import * as ts from "typescript";

const root = process.cwd();
const projectsRoot = join(root, "projects");
const finalRuntimeGate = process.argv.includes("--final-runtime");
const errors: string[] = [];
let checkedWorkflows = 0;
let checkedHandlers = 0;
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
    if (/\bProjectApp(?:Action|Context)?\b/.test(text))
      errors.push(`${display}: uses a retired Project App authoring type`);
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
        if (
          workflowEntry.includes("-helpers") ||
          workflowEntry.includes("-utils")
        )
          continue;
        workflows.push(join(workflowDir, workflowEntry));
      }
    }
  }
  return workflows;
}

function discoverEnabledHandlers(): string[] {
  const handlers = new Set<string>();
  for (const appEntry of readdirSync(projectsRoot).sort()) {
    if (!appEntry.endsWith(".app")) continue;
    const agentsDir = join(projectsRoot, appEntry, "agents");
    if (!existsSync(agentsDir)) continue;
    for (const agentEntry of readdirSync(agentsDir).sort()) {
      const agentDir = join(agentsDir, agentEntry);
      const cronPath = join(agentDir, "cron.json");
      if (!existsSync(cronPath)) continue;
      let entries: unknown;
      try {
        entries = JSON.parse(readFileSync(cronPath, "utf8"));
      } catch (error) {
        errors.push(
          `${relative(root, cronPath)}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }
      if (!Array.isArray(entries)) {
        errors.push(`${relative(root, cronPath)}: expected a JSON array`);
        continue;
      }
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;
        const record = entry as Record<string, unknown>;
        if (record.enabled === false || typeof record.handler !== "string")
          continue;
        const handlerName = record.handler.trim();
        if (!handlerName) continue;
        const handlerPath = join(agentDir, "handlers", `${handlerName}.ts`);
        if (!existsSync(handlerPath)) {
          errors.push(
            `${relative(root, cronPath)}: enabled handler ${handlerName} has no ${relative(root, handlerPath)}`,
          );
          continue;
        }
        handlers.add(handlerPath);
      }
    }
  }
  return [...handlers].sort();
}

function checkTypescriptCompatibility(
  runtimeRoot: string,
  entrypoints: string[],
): void {
  const sdkSourceRoot = join(runtimeRoot, "packages", "sdk", "src");
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: false,
    skipLibCheck: true,
    noEmit: true,
    allowImportingTsExtensions: true,
    esModuleInterop: true,
    types: ["node", "bun"],
    paths: {
      "@may-agent/sdk": [join(sdkSourceRoot, "index.ts")],
      "@may-agent/sdk/*": [join(sdkSourceRoot, "*.ts")],
      "@may-agent/gym/*": [join(root, "projects/gym/src/*/index.ts")],
    },
  };
  const program = ts.createProgram({ rootNames: entrypoints, options });
  for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
    const message = ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      "\n",
    );
    if (!diagnostic.file || diagnostic.start === undefined) {
      errors.push(`paired Runtime typecheck: ${message}`);
      continue;
    }
    const position = diagnostic.file.getLineAndCharacterOfPosition(
      diagnostic.start,
    );
    errors.push(
      `${relative(root, diagnostic.file.fileName)}:${position.line + 1}:${position.character + 1}: ${message}`,
    );
  }
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
  const handlers = discoverEnabledHandlers();
  checkedWorkflows = workflows.length;
  checkedHandlers = handlers.length;
  checkTypescriptCompatibility(runtimeRoot, [...workflows, ...handlers]);
  for (const workflowPath of [...workflows, ...handlers]) {
    let result: Awaited<ReturnType<typeof Bun.build>>;
    try {
      result = await Bun.build({
        entrypoints: [workflowPath],
        target: "bun",
        format: "esm",
        write: false,
        minify: false,
        external: ["typebox", "@earendil-works/pi-ai"],
        plugins: [sdkPlugin],
      });
    } catch (error) {
      errors.push(
        `${relative(root, workflowPath)}: incompatible with paired Runtime SDK: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }
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
  `Canonical Agent App integrity: ${errors.length} error(s); ${finalRuntimeGate ? `Apps + final Runtime (${checkedWorkflows} workflows and ${checkedHandlers} enabled handlers checked)` : "Apps"}`,
);
if (errors.length > 0) process.exitCode = 1;
