import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { listOwnedCases } from "./catalog";
import { loadLabels } from "../loop/store";

/** Structural checks only. They neither approve answers nor execute agents. */
export function validateCaseCatalog(root: string) {
  const issues: string[] = [];
  let cases = 0,
    benchmarks = 0;
  try {
    const entries = listOwnedCases(root),
      names = new Set(entries.map((entry) => entry.benchmark));
    cases = entries.length;
    benchmarks = names.size;
    for (const entry of entries) {
      const { suite, benchmark, id, inlineCase, directory } = entry;
      if (!suite.purpose?.trim())
        issues.push(`${benchmark}: purpose is required`);
      if (!suite.case_ids)
        issues.push(
          `${benchmark}: use case_ids, not a global scenario collection`,
        );
      if (suite.defaults?.agent_type)
        issues.push(
          `${benchmark}: select the target at run time, not with a benchmark-owned agent default`,
        );
      const core = suite.core_cases ?? [];
      if (
        new Set(core).size !== core.length ||
        core.some((value) => !suite.scenarios.includes(value))
      )
        issues.push(`${benchmark}: invalid core_cases selection`);
      if (inlineCase) {
        if (!inlineCase.task?.trim())
          issues.push(`${benchmark}/${id}: missing task`);
        if (!inlineCase.expected)
          issues.push(`${benchmark}/${id}: missing expectations`);
        for (const path of Object.keys(inlineCase.files ?? {})) {
          if (isAbsolute(path) || path.split(/[\\/]/).includes(".."))
            issues.push(`${benchmark}/${id}: escaping fixture path ${path}`);
        }
      } else if (directory) {
        for (const file of ["case.json", "task.md", "expected.json"]) {
          if (!existsSync(join(directory, file)))
            issues.push(`${benchmark}/${id}: missing ${file}`);
        }
        const environment = join(directory, "environment");
        if (existsSync(environment) && !statSync(environment).isDirectory())
          issues.push(`${benchmark}/${id}: environment must be a directory`);
        if (existsSync(join(directory, "case.json"))) {
          const meta = JSON.parse(
            readFileSync(join(directory, "case.json"), "utf8"),
          );
          if (meta.name !== id)
            issues.push(`${benchmark}/${id}: metadata ID mismatch`);
        }
      }
      if (
        !suite.evaluator ||
        !existsSync(join(entry.benchmarkDir, suite.evaluator))
      )
        issues.push(`${benchmark}: evaluator is unavailable; build Gym first`);
    }
    for (const name of names) {
      const entry = entries.find((item) => item.benchmark === name)!;
      loadLabels(name, entry.suite, root); // Preserve approval-integrity checks.
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
  return {
    passed: issues.length === 0,
    cases,
    benchmarks,
    issues: [...new Set(issues)],
  };
}
