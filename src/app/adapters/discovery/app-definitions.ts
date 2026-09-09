import { existsSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  importRuntimeModule,
  invalidateRuntimeModuleCache,
  type RuntimeImportOptions,
} from "../../../lib/runtime-import.js";
import type { AppDefinitionSource } from "../../core/apps/registry.js";

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

/** Conventional file source; the registry invokes it within serialized reload. */
export function discoverAppDefinitions(
  projectsRoot: string,
  canonicalProjectsRoot = projectsRoot,
  importOptions: RuntimeImportOptions = {},
): AppDefinitionSource {
  return async () => {
    // Refresh only when invoked, so failed and queued reloads see fresh code.
    invalidateRuntimeModuleCache();
    const loaded: Awaited<ReturnType<AppDefinitionSource>>[number][] = [];
    for (const modulePath of listAppDefinitionFiles(projectsRoot)) {
      const mod = await importRuntimeModule<{ default?: unknown; app?: unknown }>(modulePath, importOptions);
      const exported = mod.default ?? mod.app;
      if (!exported || typeof exported !== "object")
        throw new Error(`App module ${modulePath} must default-export an App definition`);
      const sourceAppDir = resolve(modulePath, "..");
      loaded.push({ appDir: resolve(canonicalProjectsRoot, basename(sourceAppDir)), definition: exported });
    }
    return loaded;
  };
}
