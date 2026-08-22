import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const agents = readFileSync(join(root, "agents/app-ops/AGENTS.md"), "utf8");
const design = readFileSync(
  join(root, "design/inbox-dependency-observation-authority.md"),
  "utf8",
);

describe("inbox dependency observation authority", () => {
  test("makes a supplied dependency observation complete and prohibits private refinement", () => {
    expect(agents).toContain("Task persistence is Host-private.");
    expect(agents).toContain(
      "treat that read-only observation (kind, id, status, summary,\n    evidence, and any result) as the complete authority",
    );
    expect(agents).toContain(
      "Never read `.state/tasks/tree.json`, task-state files, Kanban\n    projections, or equivalent Runtime projections to refine the observation",
    );
    expect(agents).toContain(
      "replace its exact task with a deeper or different task",
    );
    expect(agents).toContain(
      "Decide from the supplied observation or return the request through\n    the proper task/App owner boundary.",
    );
  });

  test("documents the reproduced violation and the legitimate diagnostic distinction", () => {
    expect(design).toContain("Session `s_1787052224910_21`");
    expect(design).toContain("started by event `5766821`");
    expect(design).toContain("Evaluator finding event `5805788`");
    expect(design).toContain(
      "`compact/compact-feature-secops-fips-5d4873c3aa`",
    );
    expect(design).toContain(
      "`compact/patch-secops-fips-ubuntu-compat-execute-readiness-implementation-20260810`",
    );
    expect(design).toContain(
      "App-process diagnostics with no supplied\ndependency observation may inspect process facts through supported\ncontrol-plane task queries",
    );
    expect(design).toContain(
      "The absence of a supplied dependency does\nnot make direct Host-private persistence an API",
    );
  });
});
