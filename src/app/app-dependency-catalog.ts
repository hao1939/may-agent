/**
 * Shared App discovery context for conversation and Task execution.
 * Summarizes the supplied registry snapshot; does not load or run Apps.
 */
import type { AppRegistrySnapshot } from "./app-registry.js";

function schemaStringLiterals(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const node = value as Record<string, unknown>;
  const values = new Set<string>();
  if (typeof node.const === "string" && node.const.trim()) values.add(node.const.trim());
  if (Array.isArray(node.enum)) {
    for (const entry of node.enum) {
      if (typeof entry === "string" && entry.trim()) values.add(entry.trim());
    }
  }
  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    if (!Array.isArray(node[key])) continue;
    for (const entry of node[key]) {
      for (const literal of schemaStringLiterals(entry)) values.add(literal);
    }
  }
  return [...values];
}

type AppInputContract = {
  kind: string;
  requiredData: string[];
  dataTypes: Record<string, string>;
  fixedData: Record<string, string | number | boolean | null>;
};

function schemaRequiredPaths(value: unknown, prefix = "", depth = 0): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 3) return [];
  const node = value as Record<string, unknown>;
  const combined = ["allOf"].flatMap((key) => {
    const entries = node[key];
    return Array.isArray(entries) ? entries.flatMap((entry) => schemaRequiredPaths(entry, prefix, depth)) : [];
  });
  const properties =
    node.properties && typeof node.properties === "object" && !Array.isArray(node.properties)
      ? (node.properties as Record<string, unknown>)
      : {};
  const required = new Set(
    Array.isArray(node.required) ? node.required.filter((key): key is string => typeof key === "string") : [],
  );
  for (const key of required) {
    const path = prefix ? `${prefix}.${key}` : key;
    combined.push(path, ...schemaRequiredPaths(properties[key], path, depth + 1));
  }
  return [...new Set(combined)].sort().slice(0, 16);
}

function schemaFixedValues(value: unknown, prefix = "", depth = 0): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 3) return {};
  const node = value as Record<string, unknown>;
  const fixed: Record<string, string | number | boolean | null> = {};
  if (
    prefix &&
    (typeof node.const === "string" ||
      typeof node.const === "number" ||
      typeof node.const === "boolean" ||
      node.const === null)
  ) {
    fixed[prefix] = node.const as string | number | boolean | null;
  }
  for (const key of ["allOf"] as const) {
    if (!Array.isArray(node[key])) continue;
    for (const entry of node[key]) Object.assign(fixed, schemaFixedValues(entry, prefix, depth));
  }
  const properties =
    node.properties && typeof node.properties === "object" && !Array.isArray(node.properties)
      ? (node.properties as Record<string, unknown>)
      : {};
  for (const [key, property] of Object.entries(properties)) {
    const path = prefix ? `${prefix}.${key}` : key;
    Object.assign(fixed, schemaFixedValues(property, path, depth + 1));
  }
  return Object.fromEntries(
    Object.entries(fixed)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, 12),
  );
}

function schemaValueType(value: unknown, depth = 0): string {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 3) return "unknown";
  const node = value as Record<string, unknown>;
  if (node.type === "array") {
    const itemType = schemaValueType(node.items, depth + 1);
    return itemType.includes("|") ? `(${itemType})[]` : `${itemType}[]`;
  }
  if (typeof node.type === "string") return node.type;
  if (Array.isArray(node.type)) {
    const types = node.type.filter((entry): entry is string => typeof entry === "string");
    if (types.length) return [...new Set(types)].sort().join("|");
  }
  const variants = ["anyOf", "oneOf"].flatMap((key) => {
    const entries = node[key];
    return Array.isArray(entries) ? entries.map((entry) => schemaValueType(entry, depth + 1)) : [];
  });
  const concrete = [...new Set(variants.filter((entry) => entry !== "unknown"))].sort();
  if (concrete.length) return concrete.join("|");
  if (node.properties || node.additionalProperties || node.allOf) return "object";
  if (node.const === null) return "null";
  if (["string", "number", "boolean"].includes(typeof node.const)) return typeof node.const;
  return "unknown";
}

function schemaDataTypes(value: unknown, prefix = "", depth = 0): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 3) return {};
  const node = value as Record<string, unknown>;
  const types: Record<string, string> = {};
  if (Array.isArray(node.allOf)) {
    for (const entry of node.allOf) Object.assign(types, schemaDataTypes(entry, prefix, depth));
  }
  const properties =
    node.properties && typeof node.properties === "object" && !Array.isArray(node.properties)
      ? (node.properties as Record<string, unknown>)
      : {};
  for (const [key, property] of Object.entries(properties)) {
    const path = prefix ? `${prefix}.${key}` : key;
    types[path] = schemaValueType(property, depth + 1);
    Object.assign(types, schemaDataTypes(property, path, depth + 1));
  }
  return Object.fromEntries(
    Object.entries(types)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, 24),
  );
}

function appInputContracts(schema: unknown): AppInputContract[] {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return [];
  const node = schema as Record<string, unknown>;
  const properties =
    node.properties && typeof node.properties === "object" && !Array.isArray(node.properties)
      ? (node.properties as Record<string, unknown>)
      : {};
  const kinds = schemaStringLiterals(properties.kind);
  const own = kinds.map((kind) => ({
    kind,
    requiredData: schemaRequiredPaths(properties.data),
    dataTypes: schemaDataTypes(properties.data),
    fixedData: schemaFixedValues(properties.data),
  }));
  const nested = ["anyOf", "oneOf"].flatMap((key) => {
    const entries = node[key];
    return Array.isArray(entries) ? entries.flatMap(appInputContracts) : [];
  });
  const byKind = new Map<string, AppInputContract>();
  for (const contract of [...own, ...nested]) byKind.set(contract.kind, contract);
  return [...byKind.values()].sort((left, right) => left.kind.localeCompare(right.kind));
}

export function appDependencyCatalog(
  entries: AppRegistrySnapshot["entries"],
  sourceAppId: string,
): Array<{ appId: string; description: string; inputs: AppInputContract[] }> {
  return entries
    .filter(({ definition }) => definition.id !== sourceAppId && definition.task && definition.tasks)
    .map(({ definition }) => ({
      appId: definition.id,
      description: definition.description?.trim() || "No description declared.",
      inputs: appInputContracts(definition.inputSchema),
    }))
    .sort((left, right) => left.appId.localeCompare(right.appId));
}
