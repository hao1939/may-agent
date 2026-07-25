import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

type UnitStatus = "draft" | "pilot" | "active" | "retired";

interface RegistryEntry {
  id: string;
  path: string;
}

interface LearningRegistry {
  schema_version: 1;
  agent: string;
  competencies?: string;
  units: RegistryEntry[];
}

interface CompetencyIndex {
  schema_version: 1;
  competencies: Array<{ id: string; path: string }>;
}

interface Competency {
  schema_version: 1;
  id: string;
  version: number;
  objective: string;
  criticality: "standard" | "high" | "critical";
  sources: SourceReference[];
  prerequisites: string[];
  dimensions: string[];
  tiers: number[];
}

interface SourceReference {
  path: string;
  section?: string;
}

interface LearningUnit {
  schema_version: 1;
  id: string;
  version: number;
  status: UnitStatus;
  title: string;
  lesson: string;
  practice: string;
  evidence: string;
  competencies: string[];
  sources: SourceReference[];
  benchmark: string;
  release_benchmark?: string;
  practice_scenarios: string[];
  development_scenarios: string[];
  release_scenarios: string[];
}

interface EvidenceRow {
  schema_version: 1;
  id: string;
  polarity: "positive" | "negative" | "contrast";
  run_id: string;
  scenario: string;
  trials: number[];
  compare_scenario?: string;
  compare_trials?: number[];
  competencies: string[];
  summary: string;
  label_status: "draft" | "approved";
}

export interface LearningUnitContext {
  id: string;
  version: number;
  title: string;
  competencies: string[];
  lessonPath: string;
  practicePath: string;
  evidencePath: string;
  sourcePaths: string[];
  releaseBenchmark: string;
  releaseScenarios: string[];
}

export interface LearningUnitReview {
  id: string;
  version: number;
  status: UnitStatus;
  title: string;
  benchmark: string;
  release_benchmark: string;
  competencies: string[];
  evidence: {
    positive: number;
    negative: number;
    contrast: number;
  };
  practice_scenarios: string[];
  development_scenarios: string[];
  release_scenarios: string[];
  ready_for_development: boolean;
  ready_for_release: boolean;
}

export interface LearningReview {
  schema_version: 1;
  agent: string;
  fingerprint: string;
  errors: string[];
  warnings: string[];
  units: LearningUnitReview[];
}

interface LoadedUnit {
  unit: LearningUnit;
  unitPath: string;
  unitDir: string;
  lessonPath: string;
  practicePath: string;
  evidencePath: string;
  sourcePaths: string[];
  evidence: EvidenceRow[];
}

function json<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function validId(value: string): boolean {
  return /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(value);
}

function inside(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function localPath(root: string, value: string, label: string): string {
  const candidate = resolve(root, value);
  if (!inside(root, candidate)) {
    throw new Error(`${label} escapes its learning unit: ${value}`);
  }
  return candidate;
}

function parseEvidence(path: string): EvidenceRow[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line) as EvidenceRow;
      } catch (error) {
        throw new Error(
          `${path}:${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
}

function loadUnits(gymRoot: string): {
  registry: LearningRegistry;
  registryPath: string;
  registryDir: string;
  units: LoadedUnit[];
} {
  const registryDir = join(gymRoot, "benchmarks", "may-learning");
  const registryPath = join(registryDir, "registry.json");
  const registry = json<LearningRegistry>(registryPath);
  const units = registry.units.map((entry) => {
    const unitPath = localPath(registryDir, entry.path, `unit ${entry.id}`);
    const unit = json<LearningUnit>(unitPath);
    const unitDir = dirname(unitPath);
    const lessonPath = localPath(unitDir, unit.lesson, `${unit.id} lesson`);
    const practicePath = localPath(
      unitDir,
      unit.practice,
      `${unit.id} practice`,
    );
    const evidencePath = localPath(
      unitDir,
      unit.evidence,
      `${unit.id} evidence`,
    );
    return {
      unit,
      unitPath,
      unitDir,
      lessonPath,
      practicePath,
      evidencePath,
      sourcePaths: unit.sources.map((source) => resolve(gymRoot, source.path)),
      evidence: parseEvidence(evidencePath),
    };
  });
  return { registry, registryPath, registryDir, units };
}

function loadCompetencies(
  gymRoot: string,
  registryDir: string,
  registry: LearningRegistry,
): {
  indexPath: string | null;
  index: CompetencyIndex | null;
  records: Array<{
    competency: Competency;
    path: string;
    sourcePaths: string[];
  }>;
} {
  if (!registry.competencies) {
    return { indexPath: null, index: null, records: [] };
  }
  const indexPath = localPath(
    registryDir,
    registry.competencies,
    "competency index",
  );
  const index = json<CompetencyIndex>(indexPath);
  const indexDir = dirname(indexPath);
  return {
    indexPath,
    index,
    records: index.competencies.map((entry) => {
      const path = localPath(indexDir, entry.path, `competency ${entry.id}`);
      const competency = json<Competency>(path);
      return {
        competency,
        path,
        sourcePaths: competency.sources.map((source) =>
          resolve(gymRoot, source.path),
        ),
      };
    }),
  };
}

function addFile(
  hash: ReturnType<typeof createHash>,
  root: string,
  path: string,
): void {
  hash.update(relative(root, path));
  hash.update("\0");
  hash.update(readFileSync(path));
  hash.update("\0");
}

export function buildLearningReview(
  gymRoot = resolve(import.meta.dirname, "../.."),
): LearningReview {
  const errors: string[] = [];
  const warnings: string[] = [];
  const hash = createHash("sha256");
  let loaded: ReturnType<typeof loadUnits>;
  try {
    loaded = loadUnits(gymRoot);
  } catch (error) {
    return {
      schema_version: 1,
      agent: "may",
      fingerprint: "sha256:invalid",
      errors: [error instanceof Error ? error.message : String(error)],
      warnings,
      units: [],
    };
  }

  addFile(hash, gymRoot, loaded.registryPath);
  if (loaded.registry.schema_version !== 1)
    errors.push("registry schema_version must be 1");
  if (loaded.registry.agent !== "may")
    errors.push("the first learning registry must target may");
  const entryIds = new Set<string>();
  for (const entry of loaded.registry.units) {
    if (!validId(entry.id))
      errors.push(`invalid registry unit id: ${entry.id}`);
    if (entryIds.has(entry.id))
      errors.push(`duplicate registry unit: ${entry.id}`);
    entryIds.add(entry.id);
  }

  const competencyIds = new Set<string>();
  if (!loaded.registry.competencies) {
    warnings.push("learning registry has no competency index");
  } else {
    try {
      const catalog = loadCompetencies(
        gymRoot,
        loaded.registryDir,
        loaded.registry,
      );
      if (catalog.indexPath) addFile(hash, gymRoot, catalog.indexPath);
      if (catalog.index?.schema_version !== 1) {
        errors.push("competency index schema_version must be 1");
      }
      for (const [index, entry] of (
        catalog.index?.competencies ?? []
      ).entries()) {
        const record = catalog.records[index];
        if (!validId(entry.id))
          errors.push(`invalid competency id: ${entry.id}`);
        if (competencyIds.has(entry.id)) {
          errors.push(`duplicate competency: ${entry.id}`);
        }
        competencyIds.add(entry.id);
        if (!record || record.competency.id !== entry.id) {
          errors.push(`competency index and record disagree: ${entry.id}`);
          continue;
        }
        addFile(hash, gymRoot, record.path);
        const competency = record.competency;
        if (competency.schema_version !== 1) {
          errors.push(`${entry.id} competency schema_version must be 1`);
        }
        if (!Number.isInteger(competency.version) || competency.version < 1) {
          errors.push(`${entry.id} has invalid competency version`);
        }
        if (!competency.objective.trim()) {
          errors.push(`${entry.id} has no objective`);
        }
        if (
          !(["standard", "high", "critical"] as string[]).includes(
            competency.criticality,
          )
        ) {
          errors.push(`${entry.id} has invalid criticality`);
        }
        if (
          !competency.tiers.length ||
          competency.tiers.some((tier) => ![1, 2, 3, 4].includes(tier))
        ) {
          errors.push(`${entry.id} has invalid tier coverage`);
        }
        competency.prerequisites.forEach((id) => {
          if (!catalog.index?.competencies.some((item) => item.id === id)) {
            errors.push(`${entry.id} has unknown prerequisite: ${id}`);
          }
        });
        competency.sources.forEach((source, sourceIndex) => {
          const sourcePath = record.sourcePaths[sourceIndex]!;
          if (!existsSync(sourcePath)) {
            errors.push(`${entry.id} source is missing: ${source.path}`);
            return;
          }
          addFile(hash, gymRoot, sourcePath);
          if (
            source.section &&
            !readFileSync(sourcePath, "utf8")
              .toLowerCase()
              .includes(source.section.toLowerCase())
          ) {
            errors.push(
              `${entry.id} source section is missing: ${source.path}#${source.section}`,
            );
          }
        });
      }
    } catch (error) {
      errors.push(
        `competency index is invalid: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const reviews: LearningUnitReview[] = [];
  for (const loadedUnit of loaded.units) {
    const { unit } = loadedUnit;
    addFile(hash, gymRoot, loadedUnit.unitPath);
    for (const path of [
      loadedUnit.lessonPath,
      loadedUnit.practicePath,
      loadedUnit.evidencePath,
    ]) {
      if (!existsSync(path)) {
        errors.push(`${unit.id} resource is missing: ${path}`);
      } else {
        addFile(hash, gymRoot, path);
        if (
          !readFileSync(path, "utf8").trim() &&
          !(path === loadedUnit.evidencePath && unit.status === "draft")
        ) {
          errors.push(`${unit.id} resource is empty: ${path}`);
        }
      }
    }
    if (!entryIds.has(unit.id))
      errors.push(`unit is not registered: ${unit.id}`);
    if (!validId(unit.id)) errors.push(`invalid unit id: ${unit.id}`);
    if (!Number.isInteger(unit.version) || unit.version < 1)
      errors.push(`${unit.id} has invalid version`);
    if (
      !(["draft", "pilot", "active", "retired"] as string[]).includes(
        unit.status,
      )
    )
      errors.push(`${unit.id} has invalid status`);
    if (!unit.competencies.length)
      errors.push(`${unit.id} has no competencies`);
    if (new Set(unit.competencies).size !== unit.competencies.length)
      errors.push(`${unit.id} has duplicate competencies`);
    if (
      competencyIds.size > 0 &&
      !unit.competencies.every((id) => competencyIds.has(id))
    ) {
      errors.push(`${unit.id} references an unknown competency`);
    }

    unit.sources.forEach((source, index) => {
      const sourcePath = loadedUnit.sourcePaths[index]!;
      if (!existsSync(sourcePath)) {
        errors.push(`${unit.id} source is missing: ${source.path}`);
        return;
      }
      addFile(hash, gymRoot, sourcePath);
      if (
        source.section &&
        !readFileSync(sourcePath, "utf8")
          .toLowerCase()
          .includes(source.section.toLowerCase())
      ) {
        errors.push(
          `${unit.id} source section is missing: ${source.path}#${source.section}`,
        );
      }
    });

    const partitions = [
      ["practice", unit.practice_scenarios],
      ["development", unit.development_scenarios],
      ["release", unit.release_scenarios],
    ] as const;
    const partitionByScenario = new Map<string, string>();
    for (const [partition, scenarios] of partitions) {
      for (const scenario of scenarios) {
        const previous = partitionByScenario.get(scenario);
        if (previous)
          errors.push(
            `${unit.id} scenario appears in ${previous} and ${partition}: ${scenario}`,
          );
        partitionByScenario.set(scenario, partition);
      }
    }

    let developmentApproved = true;
    let releaseApproved = unit.release_scenarios.length > 0;
    for (const [partition, scenarios] of partitions) {
      const benchmark =
        partition === "release"
          ? (unit.release_benchmark ?? unit.benchmark)
          : unit.benchmark;
      const benchmarkDir = join(gymRoot, "benchmarks", benchmark);
      const suitePath = join(benchmarkDir, "suite.json");
      const suite = existsSync(suitePath)
        ? json<{ labels_file?: string; scenarios?: string[] }>(suitePath)
        : null;
      if (!suite) errors.push(`${unit.id} benchmark is missing: ${benchmark}`);
      else addFile(hash, gymRoot, suitePath);
      const labelsPath = join(
        benchmarkDir,
        suite?.labels_file ?? "labels.json",
      );
      const labels = existsSync(labelsPath)
        ? (json<{ labels?: Record<string, { status?: string }> }>(labelsPath)
            .labels ?? {})
        : {};
      if (existsSync(labelsPath)) addFile(hash, gymRoot, labelsPath);
      else errors.push(`${unit.id} benchmark labels are missing: ${benchmark}`);
      for (const scenario of scenarios) {
        if (!suite?.scenarios?.includes(scenario)) {
          errors.push(
            `${unit.id} ${partition} scenario is not in ${benchmark}: ${scenario}`,
          );
          if (partition === "development") developmentApproved = false;
          if (partition === "release") releaseApproved = false;
          continue;
        }
        const scenarioDir = join(gymRoot, "scenarios", scenario);
        for (const relativePath of [
          "scenario.json",
          "task.md",
          "expected.json",
          "success_criteria.js",
          "environment/system-state.md",
        ]) {
          const path = join(scenarioDir, relativePath);
          if (!existsSync(path))
            errors.push(`${scenario} is missing ${relativePath}`);
          else addFile(hash, gymRoot, path);
        }
        if (
          partition !== "practice" &&
          labels[scenario]?.status !== "approved"
        ) {
          if (partition === "development") developmentApproved = false;
          if (partition === "release") releaseApproved = false;
          const message = `${unit.id} ${partition} truth is not approved: ${scenario}`;
          if (partition === "development" && unit.status !== "draft") {
            errors.push(message);
          } else {
            warnings.push(message);
          }
        }
      }
    }

    const evidenceIds = new Set<string>();
    const counts = { positive: 0, negative: 0, contrast: 0 };
    for (const row of loadedUnit.evidence) {
      if (evidenceIds.has(row.id))
        errors.push(`${unit.id} has duplicate evidence id: ${row.id}`);
      evidenceIds.add(row.id);
      if (!(row.polarity in counts)) {
        errors.push(`${unit.id} has invalid evidence polarity: ${row.id}`);
      } else {
        counts[row.polarity]++;
      }
      if (!row.run_id || !row.scenario || !row.trials?.length || !row.summary)
        errors.push(`${unit.id} has incomplete evidence: ${row.id}`);
      if (!row.competencies?.every((id) => unit.competencies.includes(id)))
        errors.push(`${unit.id} evidence has unknown competency: ${row.id}`);
    }
    if (!counts.positive) warnings.push(`${unit.id} has no positive evidence`);
    if (!counts.negative) warnings.push(`${unit.id} has no negative evidence`);
    if (!counts.contrast) warnings.push(`${unit.id} has no contrast evidence`);
    if (!unit.release_scenarios.length)
      warnings.push(`${unit.id} has no withheld release scenarios yet`);

    reviews.push({
      id: unit.id,
      version: unit.version,
      status: unit.status,
      title: unit.title,
      benchmark: unit.benchmark,
      release_benchmark: unit.release_benchmark ?? unit.benchmark,
      competencies: unit.competencies,
      evidence: counts,
      practice_scenarios: unit.practice_scenarios,
      development_scenarios: unit.development_scenarios,
      release_scenarios: unit.release_scenarios,
      ready_for_development: developmentApproved,
      ready_for_release: releaseApproved,
    });
  }

  return {
    schema_version: 1,
    agent: loaded.registry.agent,
    fingerprint: `sha256:${hash.digest("hex")}`,
    errors,
    warnings,
    units: reviews,
  };
}

export function resolveLearningContexts(
  gymRoot: string,
  benchmark: string,
  scenarios: string[],
): LearningUnitContext[] {
  const registryPath = join(
    gymRoot,
    "benchmarks",
    "may-learning",
    "registry.json",
  );
  if (!existsSync(registryPath)) return [];
  const review = buildLearningReview(gymRoot);
  if (review.errors.length) {
    throw new Error(
      `May learning registry is invalid: ${review.errors.join("; ")}`,
    );
  }
  const selected = new Set(scenarios);
  return loadUnits(gymRoot).units.flatMap((loaded) => {
    const { unit } = loaded;
    if (
      unit.status === "draft" ||
      unit.status === "retired" ||
      unit.benchmark !== benchmark ||
      !unit.development_scenarios.some((scenario) => selected.has(scenario))
    ) {
      return [];
    }
    return [
      {
        id: unit.id,
        version: unit.version,
        title: unit.title,
        competencies: unit.competencies,
        lessonPath: loaded.lessonPath,
        practicePath: loaded.practicePath,
        evidencePath: loaded.evidencePath,
        sourcePaths: loaded.sourcePaths,
        releaseBenchmark: unit.release_benchmark ?? unit.benchmark,
        releaseScenarios: [...unit.release_scenarios],
      },
    ];
  });
}
