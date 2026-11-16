/** Active cases have exactly one owner: benchmarks/<purpose>/.
 * Archived pre-migration definitions are evidence, not a second active catalog. */
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join, sep } from "node:path";
import type { BenchmarkSuite, InlineBenchmarkCase } from "../loop/types";

export interface OwnedCase {
  id: string;
  benchmark: string;
  benchmarkDir: string;
  directory: string | null;
  inlineCase?: InlineBenchmarkCase;
  suite: BenchmarkSuite;
}

export function resolveBenchmarkName(root: string, name: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name))
    throw new Error(`Invalid benchmark name: ${name}`);
  const path = join(root, "benchmarks", "compatibility.json");
  if (!existsSync(path)) return name;
  const mapping = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    string | string[]
  >;
  const replacement = Object.hasOwn(mapping, name) ? mapping[name] : undefined;
  if (Array.isArray(replacement)) {
    throw new Error(
      `Retired agent-named benchmark ${name}; select a purpose benchmark: ${replacement.join(", ")}. Historical runs remain readable; create a fresh baseline.`,
    );
  }
  if (replacement && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(replacement))
    throw new Error(`Invalid benchmark alias for ${name}`);
  return replacement ?? name;
}

export function readBenchmark(
  root: string,
  requested: string,
): { suite: BenchmarkSuite; path: string; benchmark: string } {
  const benchmark = resolveBenchmarkName(root, requested);
  const dir = join(root, "benchmarks", benchmark),
    path = join(dir, "suite.json");
  if (!existsSync(path)) throw new Error(`Benchmark suite not found: ${path}`);
  const suite = JSON.parse(readFileSync(path, "utf8")) as BenchmarkSuite;
  if (suite.case_ids !== undefined) {
    if (
      !Array.isArray(suite.case_ids) ||
      typeof suite.purpose !== "string" ||
      !suite.purpose.trim()
    )
      throw new Error(`Benchmark ${benchmark} requires case_ids and a purpose`);
    suite.scenarios = [...suite.case_ids];
  }
  if (suite.core_cases !== undefined) {
    if (!Array.isArray(suite.core_cases))
      throw new Error(`Invalid core_cases in ${benchmark}`);
    suite.core_scenarios = [...suite.core_cases];
  }
  if (suite.scenarios !== undefined && !Array.isArray(suite.scenarios))
    throw new Error(`Invalid case selection in ${benchmark}`);
  const casesPath = join(dir, "cases.json");
  if (existsSync(casesPath))
    suite.cases = [
      ...(suite.cases ?? []),
      ...JSON.parse(readFileSync(casesPath, "utf8")),
    ];
  const inlineIds = (suite.cases ?? []).map((item) => item.id);
  if (new Set(inlineIds).size !== inlineIds.length)
    throw new Error(`Duplicate case definition in ${benchmark}`);
  const ids = [...(suite.scenarios ?? [])];
  if (new Set(ids).size !== ids.length)
    throw new Error(`Duplicate case selection in ${benchmark}`);
  for (const id of inlineIds) if (!ids.includes(id)) ids.push(id);
  if (!suite.name || !ids.length)
    throw new Error(`Invalid benchmark suite: ${path}`);
  for (const id of ids) {
    if (
      typeof id !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(id)
    )
      throw new Error(`Invalid case ID in ${benchmark}: ${id}`);
  }
  suite.scenarios = ids; // Compatibility for retained manifests and runner APIs.
  return { suite, path, benchmark };
}

export function legacyCasesDirectory(root: string): string {
  const archived = join(root, "archive", "pre-purpose-layout", "scenarios");
  return existsSync(archived) ? archived : join(root, "scenarios");
}

export function listOwnedCases(root: string): OwnedCase[] {
  const result: OwnedCase[] = [],
    owners = new Map<string, string>();
  const benchmarks = join(root, "benchmarks");
  if (!existsSync(benchmarks)) return result;
  for (const entry of readdirSync(benchmarks, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    if (
      !entry.isDirectory() ||
      !existsSync(join(benchmarks, entry.name, "suite.json"))
    )
      continue;
    const { suite, benchmark } = readBenchmark(root, entry.name);
    const benchmarkDir = join(benchmarks, benchmark);
    for (const id of suite.scenarios) {
      const previous = owners.get(id);
      if (previous)
        throw new Error(
          `Case ${id} belongs to both ${previous} and ${benchmark}; a case must have exactly one benchmark owner`,
        );
      owners.set(id, benchmark);
      const inlineCase = suite.cases?.find((item) => item.id === id);
      const local = join(benchmarkDir, "cases", id);
      // Only old synthetic/frozen layouts may use the old global directory.
      const historical =
        !suite.case_ids && !suite.purpose ? join(root, "scenarios", id) : null;
      const directory = existsSync(local)
        ? local
        : historical && existsSync(historical)
          ? historical
          : null;
      if (
        existsSync(local) &&
        !realpathSync(local).startsWith(realpathSync(benchmarkDir) + sep)
      )
        throw new Error(`Case ${benchmark}/${id} escapes its owning benchmark`);
      if (inlineCase && directory)
        throw new Error(
          `Two definitions for ${benchmark}/${id}: inline and directory`,
        );
      if (!inlineCase && !directory)
        throw new Error(
          `Missing owned case ${benchmark}/${id}; expected ${local}`,
        );
      result.push({
        id,
        benchmark,
        benchmarkDir,
        directory,
        inlineCase,
        suite,
      });
    }
    const checkLocalBodies = (directory: string, prefix = ""): void => {
      if (!existsSync(directory)) return;
      for (const child of readdirSync(directory, { withFileTypes: true })) {
        if (!child.isDirectory()) continue;
        const id = prefix ? `${prefix}/${child.name}` : child.name;
        const path = join(directory, child.name);
        if (
          existsSync(join(path, "case.json")) ||
          existsSync(join(path, "scenario.json"))
        ) {
          if (!suite.scenarios.includes(id))
            throw new Error(
              `Unlisted case ${benchmark}/${id}; register it in case_ids`,
            );
          // Do not mistake metadata inside a case's fixtures for another case.
        } else {
          checkLocalBodies(path, id);
        }
      }
    };
    checkLocalBodies(join(benchmarkDir, "cases"));
  }
  return result;
}

export function findOwnedCase(root: string, id: string): OwnedCase | undefined {
  return listOwnedCases(root).find((item) => item.id === id);
}

export function resolveCaseDirectory(
  root: string,
  id: string,
  allowLegacy = false,
): string | null {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(id))
    throw new Error(`Invalid case ID: ${id}`);
  const owned = findOwnedCase(root, id);
  if (owned) return owned.directory;
  const legacy = join(legacyCasesDirectory(root), id);
  return allowLegacy && existsSync(legacy) ? legacy : null;
}
