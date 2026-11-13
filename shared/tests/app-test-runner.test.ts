import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const runner = resolve(import.meta.dirname, "../../scripts/run-app-tests.ts");
const fixtures: string[] = [];

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-app-test-runner-"));
  fixtures.push(root);
  function file(path: string, contents = "") {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }

  const selected = [
    "projects/alpha.app/agents/worker/workflows/current.test.ts",
    "projects/alpha.app/current.test.ts",
    "projects/alpha.app/projects/domain/current.test.ts",
    "projects/beta.app/current.test.ts",
    "shared/current.test.ts",
  ];
  file("projects/alpha.app/app.ts");
  file("projects/beta.app/app.ts");
  for (const path of selected) file(path, 'throw new Error("fixture tests must not execute");');
  for (const dir of ["archive", "workspace", "node_modules", ".state"]) {
    file(`shared/${dir}/excluded.test.ts`);
    file(`projects/alpha.app/${dir}/excluded.test.ts`);
    file(`projects/alpha.app/agents/worker/${dir}/excluded.test.ts`);
  }
  file("shared/projects/foreign.test.ts");
  file("projects/disabled.app/app.ts");
  file("projects/disabled.app/.disabled");
  file("projects/disabled.app/excluded.test.ts");
  file("projects/no-entry.app/excluded.test.ts");
  file("projects/ordinary-project/app.ts");
  file("projects/ordinary-project/excluded.test.ts");

  // Capture the real CLI's child invocations without executing App code.
  file("bin/bun", `#!${process.execPath}
import { appendFileSync } from "node:fs";
const args = process.argv.slice(2);
appendFileSync(process.env.APP_TEST_RUNNER_CALLS, JSON.stringify(args) + "\\n");
if (process.env.APP_TEST_RUNNER_FAIL === "1") {
  console.error("fixture child failed");
  process.exit(7);
}
const count = args.filter(arg => arg.endsWith(".test.ts")).length;
console.error("\\n " + count + " pass\\n " + count + " expect() calls\\nRan " + count + " tests across " + count + " files");
`);
  chmodSync(join(root, "bin/bun"), 0o755);

  return {
    file,
    selected,
    run(fail = false) {
      const callsFile = join(root, "calls.jsonl");
      const result = spawnSync(process.execPath, [runner], {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${join(root, "bin")}:${process.env.PATH ?? ""}`,
          TEST_CHUNK_SIZE: "2",
          APP_TEST_RUNNER_CALLS: callsFile,
          APP_TEST_RUNNER_FAIL: fail ? "1" : "0",
        },
      });
      const calls: string[][] = existsSync(callsFile)
        ? readFileSync(callsFile, "utf8").trim().split("\n").map(line => JSON.parse(line))
        : [];
      return { ...result, calls };
    },
  };
}

test("runs shared and enabled App tests without a legacy root agents directory", () => {
  const repo = fixture();
  const result = repo.run();
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(result.calls).toEqual([
    ["test", ...repo.selected.slice(0, 2).map(path => `./${path}`), "--timeout", "45000"],
    ["test", ...repo.selected.slice(2, 4).map(path => `./${path}`), "--timeout", "45000"],
    ["test", `./${repo.selected[4]}`, "--timeout", "45000"],
  ]);
  expect(result.stdout).toContain("5 pass\n5 expect() calls\n");
  expect(result.stdout).toContain("across 5 files");
});

test("ignores retired root agents even when a legacy checkout is present", () => {
  const repo = fixture();
  repo.file("agents/retired/workflows/old.test.ts");
  const result = repo.run();
  expect(result.status).toBe(0);
  expect(result.calls.flat().filter(arg => arg.endsWith(".test.ts"))).toEqual(
    repo.selected.map(path => `./${path}`),
  );
});

test("propagates a failing chunk's exit status and output, then stops", () => {
  const repo = fixture();
  repo.file("agents/README.md");
  const result = repo.run(true);
  expect(result.status).toBe(7);
  expect(result.stdout).toContain("fixture child failed");
  expect(result.stdout).not.toContain("Ran default app health tests");
  expect(result.calls).toHaveLength(1);
});
