import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import type { ScenarioMeta } from "./types";

export function loadScenarioMeta(scenarioDir: string): ScenarioMeta | null {
  const metaPath = join(scenarioDir, "scenario.json");
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, "utf-8")) as ScenarioMeta;
  } catch {
    return null;
  }
}

export function isRunnableScenario(scenarioDir: string): boolean {
  return (
    existsSync(join(scenarioDir, "task.md")) &&
    existsSync(join(scenarioDir, "success_criteria.js")) &&
    existsSync(join(scenarioDir, "environment"))
  );
}

export function listScenarios(scenariosDir: string): string[] {
  const scenarios: string[] = [];

  for (const name of readdirSync(scenariosDir)) {
    const dir = join(scenariosDir, name);
    if (!statSync(dir).isDirectory()) continue;

    if (isRunnableScenario(dir)) {
      scenarios.push(name);
      continue;
    }

    // Multi-session is the only supported nested scenario collection.
    if (name !== "multi-session") continue;
    for (const sub of readdirSync(dir)) {
      const subDir = join(dir, sub);
      if (!statSync(subDir).isDirectory()) continue;
      const meta = loadScenarioMeta(subDir);
      if (meta?.sessions && existsSync(join(subDir, "success_criteria.js"))) {
        scenarios.push(`${name}/${sub}`);
      }
    }
  }

  return scenarios.sort();
}

export function matchesFilters(
  meta: ScenarioMeta | null,
  tier?: string,
  category?: string,
  tag?: string,
): boolean {
  if (!tier && !category && !tag) return true;
  if (!meta) return false;

  if (tier) {
    switch (tier) {
      case "smoke":
        if ((meta.tier || "") !== "smoke") return false;
        break;
      case "standard":
        if ((meta.tier || "") !== "smoke" && (meta.tier || "") !== "standard") return false;
        break;
      case "full":
        break;
      default:
        if ((meta.tier || "") !== tier) return false;
    }
  }

  if (category && !(meta.categories || []).includes(category)) return false;
  if (tag && !(meta.tags || []).includes(tag)) return false;
  return true;
}

