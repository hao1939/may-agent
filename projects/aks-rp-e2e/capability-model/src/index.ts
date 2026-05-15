export type SpaceKind = "input" | "expectation";
export type TestResult = "pass" | "fail" | "blocked" | "unknown";
export type ConstraintKind = "requires" | "excludes";

export interface VariableDef {
  id: string;
  label?: string;
  description?: string;
  domain: string[];
}

export interface VariableDependency {
  parent: string;
  parentValue?: string;
  child: string;
  reason?: string;
}

export interface Assignment {
  variable: string;
  value: string;
}

export interface Constraint {
  id: string;
  kind: ConstraintKind;
  if: Assignment[];
  then: Assignment[];
  reason?: string;
}

export interface FeatureDef {
  id: string;
  label?: string;
  description?: string;
  inputPath: Assignment[];
  expectationPath: Assignment[];
}

export interface EvidenceRef {
  id: string;
  kind: "artifact" | "session" | "source" | "note";
  path?: string;
  sessionId?: string;
  summary?: string;
}

export interface TestCaseDef {
  id: string;
  label?: string;
  featureId?: string;
  contextPath?: Assignment[];
  inputPath: Assignment[];
  expectationPath: Assignment[];
  observedPath?: Assignment[];
  result: TestResult;
  evidence: string[];
  diagnosis?: {
    kind: string;
    summary?: string;
  };
  notes?: string;
}

export interface JudgmentDef {
  id: string;
  featureId: string;
  status: TestResult;
  contextPath: Assignment[];
  inputPath: Assignment[];
  expectationPath: Assignment[];
  observedPath: Assignment[];
  evidence: string[];
  testCases?: string[];
  summary?: string;
  nextAction?: string;
  diagnosis?: {
    kind: string;
    summary?: string;
  };
}

export interface CapabilityModel {
  version: 1;
  id: string;
  title?: string;
  updatedAt?: string;
  observationVariables?: VariableDef[];
  inputVariables: VariableDef[];
  inputDependencies?: VariableDependency[];
  inputConstraints?: Constraint[];
  expectationVariables: VariableDef[];
  expectationDependencies?: VariableDependency[];
  expectationConstraints?: Constraint[];
  features: FeatureDef[];
  testCases: TestCaseDef[];
  judgments?: JudgmentDef[];
  evidence: EvidenceRef[];
}

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface SpaceSummary {
  variables: number;
  roots: string[];
  paths: number;
  truncated: boolean;
}

export interface FeatureCoverage {
  featureId: string;
  label?: string;
  status: TestResult | "uncovered";
  testCaseIds: string[];
  evidenceIds: string[];
  missingEvidence: boolean;
}

export interface CapabilitySummary {
  observation: {
    variables: number;
  };
  input: SpaceSummary;
  expectation: SpaceSummary;
  features: FeatureCoverage[];
  uncoveredFeatureIds: string[];
  failingFeatureIds: string[];
  blockedFeatureIds: string[];
  unknownFeatureIds: string[];
}

export interface EnumerateOptions {
  maxPaths?: number;
}

const ID_RE = /^[a-zA-Z][a-zA-Z0-9._-]*$/;

function issue(
  issues: ValidationIssue[],
  severity: ValidationIssue["severity"],
  code: string,
  message: string,
  path?: string,
) {
  issues.push({ severity, code, message, path });
}

function depsFor(model: CapabilityModel, space: SpaceKind): VariableDependency[] {
  return space === "input" ? (model.inputDependencies ?? []) : (model.expectationDependencies ?? []);
}

function constraintsFor(model: CapabilityModel, space: SpaceKind): Constraint[] {
  return space === "input" ? (model.inputConstraints ?? []) : (model.expectationConstraints ?? []);
}

function varsFor(model: CapabilityModel, space: SpaceKind): VariableDef[] {
  return space === "input" ? model.inputVariables : model.expectationVariables;
}

function varMapFor(model: CapabilityModel, space: SpaceKind): Map<string, VariableDef> {
  return new Map(varsFor(model, space).map((v) => [v.id, v]));
}

function assignmentMap(assignments: Assignment[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of assignments) map.set(a.variable, a.value);
  return map;
}

function containsAssignment(assignments: Assignment[], expected: Assignment): boolean {
  return assignments.some((a) => a.variable === expected.variable && a.value === expected.value);
}

function matchesAll(assignments: Map<string, string>, expected: Assignment[]): boolean {
  return expected.every((a) => assignments.get(a.variable) === a.value);
}

function pathKey(path: Assignment[]): string {
  return [...path]
    .sort((a, b) => a.variable.localeCompare(b.variable))
    .map((a) => `${a.variable}=${a.value}`)
    .join("|");
}

function validateIds(issues: ValidationIssue[], items: { id: string }[], label: string, path: string) {
  const seen = new Set<string>();
  for (const [idx, item] of items.entries()) {
    const itemPath = `${path}[${idx}]`;
    if (!item.id || !ID_RE.test(item.id)) {
      issue(issues, "error", "invalid-id", `${label} id must be non-empty and identifier-like: ${item.id}`, `${itemPath}.id`);
    }
    if (seen.has(item.id)) issue(issues, "error", "duplicate-id", `Duplicate ${label} id: ${item.id}`, `${itemPath}.id`);
    seen.add(item.id);
  }
}

function validateVariables(issues: ValidationIssue[], variables: VariableDef[], path: string) {
  validateIds(issues, variables, "variable", path);
  for (const [idx, variable] of variables.entries()) {
    const itemPath = `${path}[${idx}]`;
    if (!Array.isArray(variable.domain) || variable.domain.length === 0) {
      issue(issues, "error", "empty-domain", `Variable ${variable.id} must have a finite non-empty domain`, `${itemPath}.domain`);
      continue;
    }
    const seen = new Set<string>();
    for (const [valueIdx, value] of variable.domain.entries()) {
      if (typeof value !== "string" || !value.trim()) {
        issue(issues, "error", "invalid-domain-value", `Variable ${variable.id} has an empty/non-string domain value`, `${itemPath}.domain[${valueIdx}]`);
      }
      if (seen.has(value)) {
        issue(issues, "error", "duplicate-domain-value", `Variable ${variable.id} repeats domain value ${value}`, `${itemPath}.domain[${valueIdx}]`);
      }
      seen.add(value);
    }
  }
}

function validateAssignmentList(
  issues: ValidationIssue[],
  variables: Map<string, VariableDef>,
  assignments: Assignment[],
  path: string,
  opts: { requirePathClosure?: boolean; dependencies?: VariableDependency[] } = {},
) {
  const seen = new Map<string, string>();
  for (const [idx, assignment] of assignments.entries()) {
    const itemPath = `${path}[${idx}]`;
    const variable = variables.get(assignment.variable);
    if (!variable) {
      issue(issues, "error", "unknown-variable", `Assignment references unknown variable ${assignment.variable}`, `${itemPath}.variable`);
      continue;
    }
    if (!variable.domain.includes(assignment.value)) {
      issue(
        issues,
        "error",
        "invalid-assignment-value",
        `Assignment ${assignment.variable}=${assignment.value} is outside domain [${variable.domain.join(", ")}]`,
        `${itemPath}.value`,
      );
    }
    const previous = seen.get(assignment.variable);
    if (previous != null && previous !== assignment.value) {
      issue(issues, "error", "conflicting-assignment", `Variable ${assignment.variable} is assigned both ${previous} and ${assignment.value}`, itemPath);
    }
    if (previous === assignment.value) {
      issue(issues, "warning", "duplicate-assignment", `Variable ${assignment.variable}=${assignment.value} is repeated`, itemPath);
    }
    seen.set(assignment.variable, assignment.value);
  }

  if (opts.requirePathClosure) {
    const depByChild = new Map<string, VariableDependency[]>();
    for (const dep of opts.dependencies ?? []) {
      const list = depByChild.get(dep.child) ?? [];
      list.push(dep);
      depByChild.set(dep.child, list);
    }
    for (const assignment of assignments) {
      for (const dep of depByChild.get(assignment.variable) ?? []) {
        const parentValue = seen.get(dep.parent);
        const satisfied = parentValue != null && (dep.parentValue == null || parentValue === dep.parentValue);
        if (!satisfied) {
          const expected = dep.parentValue == null ? dep.parent : `${dep.parent}=${dep.parentValue}`;
          issue(
            issues,
            "error",
            "path-not-closed",
            `Path assigns ${assignment.variable} but does not include required parent ${expected}`,
            path,
          );
        }
      }
    }
  }
}

function validateDependencies(
  issues: ValidationIssue[],
  variables: Map<string, VariableDef>,
  dependencies: VariableDependency[],
  path: string,
) {
  for (const [idx, dep] of dependencies.entries()) {
    const itemPath = `${path}[${idx}]`;
    const parent = variables.get(dep.parent);
    if (!parent) issue(issues, "error", "unknown-parent", `Dependency references unknown parent ${dep.parent}`, `${itemPath}.parent`);
    if (!variables.has(dep.child)) issue(issues, "error", "unknown-child", `Dependency references unknown child ${dep.child}`, `${itemPath}.child`);
    if (dep.parent === dep.child) issue(issues, "error", "self-dependency", `Variable ${dep.parent} cannot depend on itself`, itemPath);
    if (parent && dep.parentValue != null && !parent.domain.includes(dep.parentValue)) {
      issue(
        issues,
        "error",
        "invalid-parent-value",
        `Dependency parent value ${dep.parent}=${dep.parentValue} is outside domain [${parent.domain.join(", ")}]`,
        `${itemPath}.parentValue`,
      );
    }
  }

  const cycle = findCycle([...variables.keys()], dependencies);
  if (cycle.length > 0) {
    issue(issues, "error", "dependency-cycle", `Dependency graph must be acyclic; cycle: ${cycle.join(" -> ")}`, path);
  }
}

function validateConstraints(
  issues: ValidationIssue[],
  variables: Map<string, VariableDef>,
  constraints: Constraint[],
  path: string,
) {
  validateIds(issues, constraints, "constraint", path);
  for (const [idx, constraint] of constraints.entries()) {
    const itemPath = `${path}[${idx}]`;
    if (constraint.kind !== "requires" && constraint.kind !== "excludes") {
      issue(issues, "error", "invalid-constraint-kind", `Invalid constraint kind: ${String(constraint.kind)}`, `${itemPath}.kind`);
    }
    if (!constraint.if?.length) {
      issue(issues, "error", "empty-constraint-if", `Constraint ${constraint.id} must have at least one if assignment`, `${itemPath}.if`);
    }
    if (!constraint.then?.length) {
      issue(issues, "error", "empty-constraint-then", `Constraint ${constraint.id} must have at least one then assignment`, `${itemPath}.then`);
    }
    validateAssignmentList(issues, variables, constraint.if ?? [], `${itemPath}.if`);
    validateAssignmentList(issues, variables, constraint.then ?? [], `${itemPath}.then`);
  }
}

function findCycle(nodes: string[], dependencies: VariableDependency[]): string[] {
  const graph = new Map<string, string[]>();
  for (const node of nodes) graph.set(node, []);
  for (const dep of dependencies) {
    if (!graph.has(dep.parent) || !graph.has(dep.child)) continue;
    graph.get(dep.parent)?.push(dep.child);
  }
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  function visit(node: string): string[] {
    const current = state.get(node);
    if (current === "visiting") {
      const start = stack.indexOf(node);
      return [...stack.slice(start), node];
    }
    if (current === "done") return [];
    state.set(node, "visiting");
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const cycle = visit(next);
      if (cycle.length) return cycle;
    }
    stack.pop();
    state.set(node, "done");
    return [];
  }

  for (const node of nodes) {
    const cycle = visit(node);
    if (cycle.length) return cycle;
  }
  return [];
}

function topoSort(nodes: string[], dependencies: VariableDependency[]): string[] {
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const node of nodes) {
    outgoing.set(node, []);
    indegree.set(node, 0);
  }
  for (const dep of dependencies) {
    if (!outgoing.has(dep.parent) || !indegree.has(dep.child)) continue;
    outgoing.get(dep.parent)?.push(dep.child);
    indegree.set(dep.child, (indegree.get(dep.child) ?? 0) + 1);
  }
  const ready = [...nodes].filter((node) => (indegree.get(node) ?? 0) === 0).sort();
  const ordered: string[] = [];
  while (ready.length) {
    const node = ready.shift()!;
    ordered.push(node);
    for (const child of outgoing.get(node) ?? []) {
      const next = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, next);
      if (next === 0) ready.push(child);
    }
    ready.sort();
  }
  return ordered.length === nodes.length ? ordered : nodes;
}

function activeFor(variableId: string, dependencies: VariableDependency[], assignments: Map<string, string>): boolean {
  const parents = dependencies.filter((dep) => dep.child === variableId);
  if (parents.length === 0) return true;
  return parents.every((dep) => {
    const parentValue = assignments.get(dep.parent);
    return parentValue != null && (dep.parentValue == null || parentValue === dep.parentValue);
  });
}

function satisfiesConstraints(assignments: Map<string, string>, constraints: Constraint[]): boolean {
  for (const constraint of constraints) {
    const ifMatches = matchesAll(assignments, constraint.if);
    if (!ifMatches) continue;
    const thenMatches = matchesAll(assignments, constraint.then);
    if (constraint.kind === "requires" && !thenMatches) return false;
    if (constraint.kind === "excludes" && thenMatches) return false;
  }
  return true;
}

export function enumerateSpace(model: CapabilityModel, space: SpaceKind, options: EnumerateOptions = {}): { paths: Assignment[][]; truncated: boolean } {
  const variables = varMapFor(model, space);
  const orderedIds = topoSort([...variables.keys()], depsFor(model, space));
  const dependencies = depsFor(model, space);
  const constraints = constraintsFor(model, space);
  const maxPaths = options.maxPaths ?? 10000;
  const paths: Assignment[][] = [];
  let truncated = false;

  function walk(index: number, current: Assignment[], currentMap: Map<string, string>) {
    if (paths.length >= maxPaths) {
      truncated = true;
      return;
    }
    if (index >= orderedIds.length) {
      if (satisfiesConstraints(currentMap, constraints)) paths.push([...current]);
      return;
    }

    const variableId = orderedIds[index];
    const variable = variables.get(variableId);
    if (!variable) return walk(index + 1, current, currentMap);

    if (!activeFor(variableId, dependencies, currentMap)) {
      walk(index + 1, current, currentMap);
      return;
    }

    for (const value of variable.domain) {
      current.push({ variable: variableId, value });
      currentMap.set(variableId, value);
      walk(index + 1, current, currentMap);
      currentMap.delete(variableId);
      current.pop();
      if (truncated) return;
    }
  }

  walk(0, [], new Map());
  return { paths, truncated };
}

export function validateCapabilityModel(model: CapabilityModel): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (model.version !== 1) issue(issues, "error", "unsupported-version", `Unsupported capability model version: ${String(model.version)}`, "version");
  if (!model.id || !ID_RE.test(model.id)) issue(issues, "error", "invalid-model-id", `Model id must be identifier-like: ${model.id}`, "id");

  validateVariables(issues, model.inputVariables ?? [], "inputVariables");
  validateVariables(issues, model.expectationVariables ?? [], "expectationVariables");
  validateVariables(issues, model.observationVariables ?? [], "observationVariables");

  for (const space of ["input", "expectation"] as const) {
    const variables = varMapFor(model, space);
    const dependencies = depsFor(model, space);
    const constraints = constraintsFor(model, space);
    validateDependencies(issues, variables, dependencies, `${space}Dependencies`);
    validateConstraints(issues, variables, constraints, `${space}Constraints`);
  }

  validateIds(issues, model.features ?? [], "feature", "features");
  validateIds(issues, model.testCases ?? [], "test case", "testCases");
  validateIds(issues, model.judgments ?? [], "judgment", "judgments");
  validateIds(issues, model.evidence ?? [], "evidence", "evidence");

  const inputVars = varMapFor(model, "input");
  const expectationVars = varMapFor(model, "expectation");
  const observationVars = new Map((model.observationVariables ?? []).map((v) => [v.id, v]));
  const featureIds = new Set((model.features ?? []).map((f) => f.id));
  const testCaseIds = new Set((model.testCases ?? []).map((t) => t.id));
  const evidenceIds = new Set((model.evidence ?? []).map((e) => e.id));

  for (const [idx, feature] of (model.features ?? []).entries()) {
    validateAssignmentList(issues, inputVars, feature.inputPath ?? [], `features[${idx}].inputPath`, {
      requirePathClosure: true,
      dependencies: model.inputDependencies ?? [],
    });
    validateAssignmentList(issues, expectationVars, feature.expectationPath ?? [], `features[${idx}].expectationPath`, {
      requirePathClosure: true,
      dependencies: model.expectationDependencies ?? [],
    });
    if (!feature.inputPath?.length) issue(issues, "warning", "feature-without-input-path", `Feature ${feature.id} has no input path`, `features[${idx}].inputPath`);
    if (!feature.expectationPath?.length) issue(issues, "warning", "feature-without-expectation-path", `Feature ${feature.id} has no expectation path`, `features[${idx}].expectationPath`);
  }

  for (const [idx, testCase] of (model.testCases ?? []).entries()) {
    if (testCase.featureId && !featureIds.has(testCase.featureId)) {
      issue(issues, "error", "unknown-feature", `Test case ${testCase.id} references unknown feature ${testCase.featureId}`, `testCases[${idx}].featureId`);
    }
    validateAssignmentList(issues, inputVars, testCase.inputPath ?? [], `testCases[${idx}].inputPath`, {
      requirePathClosure: true,
      dependencies: model.inputDependencies ?? [],
    });
    validateAssignmentList(issues, observationVars, testCase.contextPath ?? [], `testCases[${idx}].contextPath`);
    validateAssignmentList(issues, expectationVars, testCase.expectationPath ?? [], `testCases[${idx}].expectationPath`, {
      requirePathClosure: true,
      dependencies: model.expectationDependencies ?? [],
    });
    validateAssignmentList(issues, expectationVars, testCase.observedPath ?? [], `testCases[${idx}].observedPath`, {
      requirePathClosure: false,
    });
    for (const evidenceId of testCase.evidence ?? []) {
      if (!evidenceIds.has(evidenceId)) {
        issue(issues, "error", "unknown-evidence", `Test case ${testCase.id} references unknown evidence ${evidenceId}`, `testCases[${idx}].evidence`);
      }
    }
    if (!["pass", "fail", "blocked", "unknown"].includes(testCase.result)) {
      issue(issues, "error", "invalid-test-result", `Invalid test result: ${String(testCase.result)}`, `testCases[${idx}].result`);
    }
  }

  for (const [idx, judgment] of (model.judgments ?? []).entries()) {
    if (!featureIds.has(judgment.featureId)) {
      issue(issues, "error", "unknown-feature", `Judgment ${judgment.id} references unknown feature ${judgment.featureId}`, `judgments[${idx}].featureId`);
    }
    if (!["pass", "fail", "blocked", "unknown"].includes(judgment.status)) {
      issue(issues, "error", "invalid-judgment-status", `Invalid judgment status: ${String(judgment.status)}`, `judgments[${idx}].status`);
    }
    validateAssignmentList(issues, observationVars, judgment.contextPath ?? [], `judgments[${idx}].contextPath`);
    validateAssignmentList(issues, inputVars, judgment.inputPath ?? [], `judgments[${idx}].inputPath`, {
      requirePathClosure: true,
      dependencies: model.inputDependencies ?? [],
    });
    validateAssignmentList(issues, expectationVars, judgment.expectationPath ?? [], `judgments[${idx}].expectationPath`, {
      requirePathClosure: true,
      dependencies: model.expectationDependencies ?? [],
    });
    validateAssignmentList(issues, expectationVars, judgment.observedPath ?? [], `judgments[${idx}].observedPath`, {
      requirePathClosure: false,
    });
    if (!judgment.evidence?.length) {
      issue(issues, "error", "judgment-without-evidence", `Judgment ${judgment.id} must cite at least one evidence item`, `judgments[${idx}].evidence`);
    }
    for (const evidenceId of judgment.evidence ?? []) {
      if (!evidenceIds.has(evidenceId)) {
        issue(issues, "error", "unknown-evidence", `Judgment ${judgment.id} references unknown evidence ${evidenceId}`, `judgments[${idx}].evidence`);
      }
    }
    for (const testCaseId of judgment.testCases ?? []) {
      if (!testCaseIds.has(testCaseId)) {
        issue(issues, "error", "unknown-test-case", `Judgment ${judgment.id} references unknown test case ${testCaseId}`, `judgments[${idx}].testCases`);
      }
    }
  }

  const featurePathKeys = new Map<string, string>();
  for (const feature of model.features ?? []) {
    featurePathKeys.set(feature.id, pathKey(feature.inputPath));
  }
  for (const testCase of model.testCases ?? []) {
    if (!testCase.featureId) continue;
    const featureKey = featurePathKeys.get(testCase.featureId);
    if (!featureKey) continue;
    const testAssignments = testCase.inputPath;
    const feature = model.features.find((f) => f.id === testCase.featureId);
    const coversFeaturePath = (feature?.inputPath ?? []).every((assignment) => containsAssignment(testAssignments, assignment));
    if (!coversFeaturePath) {
      issue(
        issues,
        "warning",
        "test-does-not-cover-feature-path",
        `Test case ${testCase.id} does not include the full input path for feature ${testCase.featureId}`,
        `testCases.${testCase.id}.inputPath`,
      );
    }
  }

  return { valid: issues.every((entry) => entry.severity !== "error"), issues };
}

export function summarizeCapabilityModel(model: CapabilityModel, options: EnumerateOptions = {}): CapabilitySummary {
  const input = enumerateSpace(model, "input", options);
  const expectation = enumerateSpace(model, "expectation", options);
  const featureCoverage = (model.features ?? []).map((feature): FeatureCoverage => {
    const judgments = (model.judgments ?? []).filter((judgment) => judgment.featureId === feature.id);
    const tests = (model.testCases ?? []).filter((test) => test.featureId === feature.id);
    const priority: TestResult[] = ["fail", "blocked", "unknown", "pass"];
    let status: FeatureCoverage["status"] = judgments.length ? "unknown" : tests.length ? "unknown" : "uncovered";
    for (const candidate of priority) {
      if (judgments.length ? judgments.some((judgment) => judgment.status === candidate) : tests.some((test) => test.result === candidate)) {
        status = candidate;
        break;
      }
    }
    const evidenceIds = [...new Set(judgments.length ? judgments.flatMap((judgment) => judgment.evidence ?? []) : tests.flatMap((test) => test.evidence ?? []))];
    const testCaseIdsForFeature = judgments.length ? [...new Set(judgments.flatMap((judgment) => judgment.testCases ?? []))] : tests.map((test) => test.id);
    return {
      featureId: feature.id,
      label: feature.label,
      status,
      testCaseIds: testCaseIdsForFeature,
      evidenceIds,
      missingEvidence: judgments.length
        ? judgments.some((judgment) => (judgment.evidence ?? []).length === 0)
        : tests.some((test) => (test.evidence ?? []).length === 0),
    };
  });

  const roots = (space: SpaceKind) => {
    const children = new Set(depsFor(model, space).map((dep) => dep.child));
    return varsFor(model, space)
      .map((v) => v.id)
      .filter((id) => !children.has(id));
  };

  return {
    observation: {
      variables: model.observationVariables?.length ?? 0,
    },
    input: { variables: model.inputVariables.length, roots: roots("input"), paths: input.paths.length, truncated: input.truncated },
    expectation: {
      variables: model.expectationVariables.length,
      roots: roots("expectation"),
      paths: expectation.paths.length,
      truncated: expectation.truncated,
    },
    features: featureCoverage,
    uncoveredFeatureIds: featureCoverage.filter((f) => f.status === "uncovered").map((f) => f.featureId),
    failingFeatureIds: featureCoverage.filter((f) => f.status === "fail").map((f) => f.featureId),
    blockedFeatureIds: featureCoverage.filter((f) => f.status === "blocked").map((f) => f.featureId),
    unknownFeatureIds: featureCoverage.filter((f) => f.status === "unknown").map((f) => f.featureId),
  };
}
