#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import * as ts from "typescript";

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

function isAppRuntimeDeclaration(path: string, appDir: string): boolean {
  const display = relative(appDir, path).replaceAll("\\", "/");
  if (/\.test\.[^.]+$/.test(display)) return false;
  return /^(?:app\.[^/]+|watchers\/|agents\/(?:[^/]+\/)*workflows\/)/.test(display);
}

function importSpecifiers(path: string, text: string): string[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  const addLiteral = (node: ts.Expression | undefined) => {
    if (node && ts.isStringLiteralLike(node)) specifiers.push(node.text);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addLiteral(node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      addLiteral(node.moduleReference.expression);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      specifiers.push(node.argument.literal.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      addLiteral(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
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
    for (const specifier of importSpecifiers(path, text)) {
      if (specifier === "@may-agent/sdk/runtime" || specifier.startsWith("@may-agent/sdk/runtime/")) {
        errors.push(`${display}: Apps cannot import Host-internal @may-agent/sdk/runtime`);
      }
      if (
        isAppRuntimeDeclaration(path, appDir) &&
        (specifier === "@may-agent/sdk/standalone" || specifier.startsWith("@may-agent/sdk/standalone/"))
      ) {
        errors.push(`${display}: App runtime declarations cannot import @may-agent/sdk/standalone`);
      }
    }
    if (/\bdefineProjectApp\b/.test(text))
      errors.push(`${display}: uses retired defineProjectApp`);
    if (/\bProjectApp(?:Action|Context)?\b/.test(text))
      errors.push(`${display}: uses a retired Project App authoring type`);
    if (
      display.includes("/watchers/") &&
      /\.state\/tasks\//.test(text)
    ) {
      errors.push(
        `${display}: App observer reads runtime-owned task persistence`,
      );
    }
  }
}

function isDisabledRetiredApp(appDir: string): boolean {
  return existsSync(join(appDir, ".disabled")) && !existsSync(join(appDir, "app.ts"));
}

function discoverAppWorkflows(): string[] {
  const workflows: string[] = [];
  for (const appEntry of readdirSync(projectsRoot).sort()) {
    if (!appEntry.endsWith(".app")) continue;
    const appDir = join(projectsRoot, appEntry);
    if (!statSync(appDir).isDirectory() || isDisabledRetiredApp(appDir)) continue;
    const agentsDir = join(appDir, "agents");
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

function appReachabilityFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...appReachabilityFiles(path));
    } else if (
      /\.(?:ts|tsx|js|mjs|cjs|md|json)$/.test(entry.name) &&
      !/\.test\.[^.]+$/.test(entry.name)
    ) {
      files.push(path);
    }
  }
  return files;
}

function checkWorkflowContracts(): void {
  for (const appEntry of readdirSync(projectsRoot).sort()) {
    if (!appEntry.endsWith(".app")) continue;
    const appDir = join(projectsRoot, appEntry);
    if (!statSync(appDir).isDirectory() || isDisabledRetiredApp(appDir)) continue;
    const agentsDir = join(appDir, "agents");
    if (!existsSync(agentsDir)) continue;

    const reachabilityTexts = new Map<string, string>();
    for (const file of appReachabilityFiles(appDir)) {
      reachabilityTexts.set(file, readFileSync(file, "utf8"));
    }

    const agentWorkflowSlugs = new Map<string, Set<string>>();
    for (const agentEntry of readdirSync(agentsDir).sort()) {
      const workflowDir = join(agentsDir, agentEntry, "workflows");
      const slugs = new Set<string>();
      if (existsSync(workflowDir) && statSync(workflowDir).isDirectory()) {
        for (const workflowEntry of readdirSync(workflowDir).sort()) {
          if (!workflowEntry.endsWith(".ts") || workflowEntry.endsWith(".test.ts")) continue;
          if (workflowEntry.includes("-helpers") || workflowEntry.includes("-utils")) continue;
          const workflowPath = join(workflowDir, workflowEntry);
          const display = relative(root, workflowPath);
          const slug = basename(workflowEntry, ".ts");
          slugs.add(slug);
          const text = readFileSync(workflowPath, "utf8");
          const source = ts.createSourceFile(workflowPath, text, ts.ScriptTarget.Latest, true);

          let exportedName: string | undefined;
          let hasNameExport = false;
          let hasDescriptionExport = false;
          let hasEmptyDescription = false;
          let hasExecuteExport = false;
          let isPureReexport = true;

          for (const stmt of source.statements) {
            if (ts.isExportDeclaration(stmt)) {
              if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
                for (const el of stmt.exportClause.elements) {
                  const exported = el.name.text;
                  if (exported === "name") hasNameExport = true;
                  if (exported === "description") hasDescriptionExport = true;
                  if (exported === "execute") hasExecuteExport = true;
                }
              }
              continue;
            }
            if (ts.isImportDeclaration(stmt)) continue;
            isPureReexport = false;
            const isExported =
              ts.canHaveModifiers(stmt) &&
              ts.getModifiers(stmt)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
            if (!isExported) continue;

            if (ts.isVariableStatement(stmt)) {
              for (const decl of stmt.declarationList.declarations) {
                if (!ts.isIdentifier(decl.name)) continue;
                if (decl.name.text === "name") {
                  hasNameExport = true;
                  if (decl.initializer && ts.isStringLiteralLike(decl.initializer)) {
                    exportedName = decl.initializer.text;
                  }
                } else if (decl.name.text === "description") {
                  hasDescriptionExport = true;
                  if (
                    decl.initializer &&
                    ts.isStringLiteralLike(decl.initializer) &&
                    decl.initializer.text.trim().length === 0
                  ) {
                    hasEmptyDescription = true;
                  }
                } else if (decl.name.text === "execute") {
                  hasExecuteExport = true;
                }
              }
            } else if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === "execute") {
              hasExecuteExport = true;
            }
          }

          if (!hasNameExport) {
            errors.push(`${display}: workflow must export const name`);
          } else if (exportedName !== undefined && exportedName !== slug) {
            errors.push(`${display}: exported workflow name "${exportedName}" must match file slug "${slug}"`);
          }
          if (!hasDescriptionExport || hasEmptyDescription) {
            errors.push(`${display}: workflow must export a non-empty description`);
          }
          if (!hasExecuteExport) {
            errors.push(`${display}: workflow must export execute(ctx)`);
          }

          const pairedTestPath = join(workflowDir, `${slug}.test.ts`);
          if (!isPureReexport && !existsSync(pairedTestPath)) {
            errors.push(`${display}: missing paired unit test ${relative(root, pairedTestPath)}`);
          }

          let referenced = false;
          for (const [file, fileText] of reachabilityTexts.entries()) {
            if (file === workflowPath) continue;
            if (fileText.includes(slug)) {
              referenced = true;
              break;
            }
          }
          if (!referenced) {
            errors.push(
              `${display}: orphan workflow "${slug}" is not referenced by app.ts, agent instructions/skills, or peer modules`,
            );
          }
        }
      }
      agentWorkflowSlugs.set(agentEntry, slugs);
    }

    const appManifest = join(appDir, "app.ts");
    if (existsSync(appManifest)) {
      const appText = readFileSync(appManifest, "utf8");
      const allSlugs = new Set<string>();
      for (const slugs of agentWorkflowSlugs.values()) {
        for (const s of slugs) allSlugs.add(s);
      }
      const source = ts.createSourceFile(appManifest, appText, ts.ScriptTarget.Latest, true);
      const extractStringLiterals = (expr: ts.Expression): string[] => {
        if (ts.isStringLiteralLike(expr)) return [expr.text];
        if (ts.isConditionalExpression(expr)) {
          return [
            ...extractStringLiterals(expr.whenTrue),
            ...extractStringLiterals(expr.whenFalse),
          ];
        }
        return [];
      };
      const visit = (node: ts.Node): void => {
        if (
          ts.isPropertyAssignment(node) &&
          ((ts.isIdentifier(node.name) && node.name.text === "workflow") ||
            (ts.isStringLiteralLike(node.name) && node.name.text === "workflow"))
        ) {
          for (const targetWorkflow of extractStringLiterals(node.initializer)) {
            if (!allSlugs.has(targetWorkflow)) {
              errors.push(
                `${relative(root, appManifest)}: binds missing workflow "${targetWorkflow}"`,
              );
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  }
}

function checkRetiredCronDeclarations(): void {
  for (const appEntry of readdirSync(projectsRoot).sort()) {
    if (!appEntry.endsWith(".app")) continue;
    const appDir = join(projectsRoot, appEntry);
    if (!statSync(appDir).isDirectory() || isDisabledRetiredApp(appDir)) continue;
    const agentsDir = join(appDir, "agents");
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
      if (entries.length > 0)
        errors.push(`${relative(root, cronPath)}: retired agent cron declarations must be empty; use App schedules`);
    }
  }
}

function checkTypescriptCompatibility(
  runtimeRoot: string,
  entrypoints: string[],
): void {
  const sdkSourceRoot = join(runtimeRoot, "packages", "sdk", "src");
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    lib: ["lib.es2023.full.d.ts"],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: false,
    noImplicitAny: false,
    strictNullChecks: true,
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
  const sdkPlugin: import("bun").BunPlugin = {
    name: "paired-may-agent-sdk",
    setup(build) {
      build.onResolve(
        { filter: /^@may-agent\/sdk(?:\/.*)?$/ },
        (args: { path: string }) => {
          const subpath = args.path.slice("@may-agent/sdk".length);
          const sourcePath = subpath
            ? join(sdkSourceRoot, `${subpath.slice(1)}.ts`)
            : join(sdkSourceRoot, "index.ts");
          if (!existsSync(sourcePath)) {
            throw new Error(`paired Runtime SDK does not export source for ${args.path}`);
          }
          return { path: sourcePath };
        },
      );
    },
  };

  const workflows = discoverAppWorkflows();
  checkedWorkflows = workflows.length;
  checkTypescriptCompatibility(runtimeRoot, workflows);
  for (const workflowPath of workflows) {
    let result: Awaited<ReturnType<typeof Bun.build>>;
    try {
      result = await Bun.build({
        entrypoints: [workflowPath],
        target: "bun",
        format: "esm",
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
  if (entry.endsWith(".app") && statSync(appDir).isDirectory() && !isDisabledRetiredApp(appDir))
    checkApp(appDir);
}
checkRetiredCronDeclarations();
checkWorkflowContracts();

const defaultRuntimeRoot = join(root, "projects", "may-agent");
const configuredRuntimeRoot =
  process.env.MAY_AGENT_RUNTIME_ROOT?.trim() ||
  (existsSync(join(defaultRuntimeRoot, "packages", "sdk", "package.json")) ? defaultRuntimeRoot : "");

if (finalRuntimeGate || configuredRuntimeRoot) {
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
  `Canonical Agent App integrity: ${errors.length} error(s); ${checkedWorkflows > 0 ? `Apps + Runtime (${checkedWorkflows} workflows checked)` : "Apps"}`,
);
if (errors.length > 0) process.exitCode = 1;
