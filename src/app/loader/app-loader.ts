import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AppDefinition } from "@may-agent/sdk";
import { importRuntimeModule } from "../../lib/runtime-import.js";
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

export async function loadAppDefinitions(projectsRoot: string): Promise<LoadedAppDefinition[]> {
  const loaded: LoadedAppDefinition[] = [];
  const ids = new Set<string>();
  for (const modulePath of listAppDefinitionFiles(projectsRoot)) {
    const mod = await importRuntimeModule<{ default?: AppDefinition; app?: AppDefinition }>(modulePath);
    const definition = mod.default ?? mod.app;
    if (!definition || typeof definition !== "object")
      throw new Error(`App module ${modulePath} must default-export an App definition`);
    assertValidAppDefinition(definition);
    if (ids.has(definition.id)) throw new Error(`Duplicate App id: ${definition.id}`);
    ids.add(definition.id);
    loaded.push({ appDir: resolve(modulePath, ".."), definition });
  }
  return loaded;
}
