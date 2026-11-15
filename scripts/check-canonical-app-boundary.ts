#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const runtimeRoot = process.env.MAY_AGENT_VERIFY_RUNTIME_ROOT?.trim()
  ? resolve(process.env.MAY_AGENT_VERIFY_RUNTIME_ROOT)
  : resolve(fileURLToPath(new URL("..", import.meta.url)));
const appsRoot = process.env.MAY_AGENT_VERIFY_APPS_ROOT?.trim()
  ? resolve(process.env.MAY_AGENT_VERIFY_APPS_ROOT)
  : undefined;
const errors: string[] = [];
const ignoredDirectories = new Set([
  ".git",
  ".state",
  "archive",
  "artifacts",
  "bundle",
  "node_modules",
  "workspace",
  "worktrees",
]);
const sourcePattern = /\.(?:ts|tsx|js|mjs|cjs)$/;

const retiredSdkSpecifier = ["@may-agent/sdk", "legacy"].join("/");
const retiredFactory = ["define", "Project", "App"].join("");
const retiredAdapter = ["adapt", "Legacy", "Project", "App"].join("");
const retiredProvenance = ["legacy", "project", "app"].join("-");
const retiredActionInput = ["legacy", "action"].join("-");

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    if (ignoredDirectories.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...sourceFiles(path));
    else if (sourcePattern.test(entry)) files.push(path);
  }
  return files;
}

export function importSpecifiers(path: string): string[] {
  const text = readFileSync(path, "utf8");
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

function rejectDeepSdkImports(path: string): void {
  for (const specifier of importSpecifiers(path)) {
    if (specifier.startsWith(".") && specifier.includes("packages/sdk/src/")) {
      errors.push(`${relative(runtimeRoot, path)}: deep-imports SDK source via ${JSON.stringify(specifier)}`);
    }
  }
}

function isAppRuntimeDeclaration(path: string, appDir: string): boolean {
  const display = relative(appDir, path).replaceAll("\\", "/");
  if (/\.test\.[^.]+$/.test(display)) return false;
  return /^(?:app\.[^/]+|watchers\/|agents\/(?:[^/]+\/)*workflows\/)/.test(display);
}

function rejectAppSdkImports(path: string, appDir: string, displayRoot: string): void {
  const display = relative(displayRoot, path);
  for (const specifier of importSpecifiers(path)) {
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
}

function rejectRetiredAuthoring(path: string, displayRoot: string): void {
  const text = readFileSync(path, "utf8");
  const display = relative(displayRoot, path);
  for (const [needle, label] of [
    [retiredSdkSpecifier, "retired SDK import or resolver"],
    [retiredFactory, "retired ProjectApp factory"],
    [retiredAdapter, "retired declaration adapter"],
    [retiredProvenance, "retired loader provenance"],
    [retiredActionInput, "retired action input"],
  ] as const) {
    if (text.includes(needle)) errors.push(`${display}: contains ${label}`);
  }
}

const sdkPackagePath = join(runtimeRoot, "packages", "sdk", "package.json");
const sdkPackage = JSON.parse(readFileSync(sdkPackagePath, "utf8")) as { exports?: Record<string, unknown> };
if (sdkPackage.exports?.["./legacy"] !== undefined)
  errors.push("packages/sdk/package.json exports the retired SDK entry point");

for (const retiredPath of [
  join(runtimeRoot, "packages", "sdk", "src", "legacy.ts"),
  join(runtimeRoot, "src", "app", "loader", "legacy-project-app-adapter.ts"),
]) {
  if (existsSync(retiredPath)) errors.push(`${relative(runtimeRoot, retiredPath)} still exists`);
}

for (const dir of [
  join(runtimeRoot, "packages", "sdk", "src"),
  join(runtimeRoot, "src", "app"),
  join(runtimeRoot, "src", "lib"),
]) {
  for (const path of sourceFiles(dir)) rejectRetiredAuthoring(path, runtimeRoot);
}

for (const dir of [join(runtimeRoot, "src"), join(runtimeRoot, "test")]) {
  for (const path of sourceFiles(dir)) rejectDeepSdkImports(path);
}

if (appsRoot) {
  if (!existsSync(appsRoot)) {
    errors.push(`configured Apps root does not exist: ${appsRoot}`);
  } else {
    for (const entry of readdirSync(appsRoot).sort()) {
      const appDir = join(appsRoot, entry);
      if (!entry.endsWith(".app") || !statSync(appDir).isDirectory()) continue;
      const hasDeclaration = existsSync(join(appDir, "app.ts")) || existsSync(join(appDir, "app.js"));
      if (existsSync(join(appDir, ".disabled")) && !hasDeclaration) continue;
      if (!hasDeclaration) {
        errors.push(`${basename(appDir)}: missing canonical App declaration`);
      }
      for (const path of sourceFiles(appDir)) {
        rejectRetiredAuthoring(path, appsRoot);
        rejectAppSdkImports(path, appDir, appsRoot);
      }
    }
  }
}

for (const error of errors) console.error(`ERROR ${error}`);
console.log(`Canonical App boundary: ${errors.length} error(s); Runtime${appsRoot ? " + Apps" : ""}`);
if (errors.length > 0) process.exitCode = 1;
