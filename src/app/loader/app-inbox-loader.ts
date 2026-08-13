import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AppDefinition } from "@may-agent/sdk";
import { importRuntimeModule } from "../../lib/runtime-import.js";

export type LoadedAppInboxDefinition = {
  appDir: string;
  definition: AppDefinition;
};

export function listAppInboxDefinitionFiles(projectsRoot: string): string[] {
  if (!existsSync(projectsRoot)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(projectsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.endsWith(".app")) continue;
    const appDir = resolve(projectsRoot, entry.name);
    for (const filename of ["inbox.ts", "inbox.js"]) {
      const candidate = join(appDir, filename);
      if (existsSync(candidate)) {
        files.push(candidate);
        break;
      }
    }
  }
  return files.sort();
}

export async function loadAppInboxDefinitions(projectsRoot: string): Promise<LoadedAppInboxDefinition[]> {
  const loaded: LoadedAppInboxDefinition[] = [];
  const ids = new Set<string>();
  for (const modulePath of listAppInboxDefinitionFiles(projectsRoot)) {
    const mod = await importRuntimeModule<{ default?: AppDefinition; app?: AppDefinition }>(modulePath);
    const definition = mod.default ?? mod.app;
    if (!definition || typeof definition !== "object") {
      throw new Error(`App inbox module ${modulePath} must default-export an App definition`);
    }
    if (typeof definition.id !== "string" || !definition.id.trim()) {
      throw new Error(`App inbox module ${modulePath} has no App id`);
    }
    if (ids.has(definition.id)) throw new Error(`Duplicate App inbox id: ${definition.id}`);
    ids.add(definition.id);
    loaded.push({ appDir: resolve(modulePath, ".."), definition });
  }
  return loaded;
}
