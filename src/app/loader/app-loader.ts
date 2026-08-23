import { existsSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { AppDefinition } from "@may-agent/sdk";
import { importRuntimeModule, type RuntimeImportOptions } from "../../lib/runtime-import.js";
import { assertValidAppDefinition } from "../app-definition-validation.js";

export type LoadedAppDefinition = {
  appDir: string;
  definition: AppDefinition;
};

export function listAppDefinitionFiles(projectsRoot: string): string[] {
  if (!existsSync(projectsRoot)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(projectsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.endsWith(".app")) continue;
    const appDir = resolve(projectsRoot, entry.name);
    for (const filename of ["app.ts", "app.js"]) {
      const candidate = join(appDir, filename);
      if (existsSync(candidate)) {
        files.push(candidate);
        break;
      }
    }
  }
  return files.sort();
}

export async function loadAppDefinitions(
  projectsRoot: string,
  importOptions: RuntimeImportOptions = {},
  canonicalProjectsRoot = projectsRoot,
): Promise<LoadedAppDefinition[]> {
  const loaded: LoadedAppDefinition[] = [];
  const ids = new Set<string>();
  for (const modulePath of listAppDefinitionFiles(projectsRoot)) {
    const mod = await importRuntimeModule<{ default?: AppDefinition; app?: AppDefinition }>(modulePath, importOptions);
    const exported = mod.default ?? mod.app;
    if (!exported || typeof exported !== "object")
      throw new Error(`App module ${modulePath} must default-export an App definition`);
    const definition = exported;
    assertValidAppDefinition(definition);
    if (ids.has(definition.id)) throw new Error(`Duplicate App id: ${definition.id}`);
    ids.add(definition.id);
    const sourceAppDir = resolve(modulePath, "..");
    loaded.push({ appDir: resolve(canonicalProjectsRoot, basename(sourceAppDir)), definition });
  }
  return loaded;
}
