import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const result = (passed: boolean, checks: unknown[] = []) => ({
  scenario: "sample",
  agent: "coder",
  passed,
  checks,
  summary: "A } brace is data",
});

test.each([
  { name: "success", value: result(true), runner: 0, recorder: 0, expected: "1 pass, 0 fail, 0 error", code: 0 },
  {
    name: "explicit false with no checks",
    value: result(false),
    runner: 1,
    recorder: 0,
    expected: "0 pass, 1 fail, 0 error",
    code: 1,
  },
  {
    name: "explicit false with passing checks",
    value: result(false, [{ name: "sample check", passed: true }]),
    runner: 0,
    recorder: 0,
    expected: "0 pass, 1 fail, 0 error",
    code: 1,
  },
  {
    name: "missing verdict",
    value: { scenario: "sample", agent: "coder", checks: [] },
    runner: 0,
    recorder: 0,
    expected: "0 pass, 0 fail, 1 error",
    code: 1,
  },
  {
    name: "invalid verdict",
    value: { ...result(true), passed: "false" },
    runner: 0,
    recorder: 0,
    expected: "0 pass, 0 fail, 1 error",
    code: 1,
  },
  {
    name: "invalid checks",
    value: result(true, [null]),
    runner: 0,
    recorder: 0,
    expected: "0 pass, 0 fail, 1 error",
    code: 1,
  },
  { name: "missing result", value: null, runner: 1, recorder: 0, expected: "0 pass, 0 fail, 1 error", code: 1 },
  ...[
    { name: "wrong scenario", value: { ...result(true), scenario: "another" } },
    { name: "wrong agent", value: { ...result(true), agent: "another" } },
    { name: "missing check name", value: result(true, [{ passed: true }]) },
    { name: "empty check name", value: result(true, [{ name: " ", passed: true }]) },
  ].map((item) => ({ ...item, runner: 0, recorder: 0, expected: "0 pass, 0 fail, 1 error", code: 1, record: false })),
  {
    name: "failed process claiming success",
    value: result(true),
    runner: 124,
    recorder: 0,
    expected: "0 pass, 0 fail, 1 error",
    code: 1,
  },
  {
    name: "failed recording",
    value: result(true),
    runner: 0,
    recorder: 1,
    expected: "0 pass, 0 fail, 1 error",
    code: 1,
  },
])("Gym baseline preserves $name", async ({ value, runner, recorder, expected, code, record = true }) => {
  const root = mkdtempSync(join(tmpdir(), "may-gym-baseline-"));
  try {
    const scripts = join(root, "scripts");
    mkdirSync(scripts);
    copyFileSync(new URL("./gym-baseline.sh", import.meta.url), join(scripts, "gym-baseline.sh"));
    writeFileSync(
      join(scripts, "gym-run.sh"),
      `#!/usr/bin/env bash
printf '%s\\n' 'fixture progress' "$FIXTURE_RESULT"
exit "$FIXTURE_RUNNER_EXIT"
`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(scripts, "gym-record.ts"),
      `import { readFileSync, writeFileSync } from "node:fs";
writeFileSync(process.env.FIXTURE_RECORDED!, readFileSync(process.argv[process.argv.indexOf("--result") + 1]!));
process.exit(Number(process.env.FIXTURE_RECORDER_EXIT));
`,
    );
    const recorded = join(root, "recorded.json");
    const observed = await promisify(execFile)("bash", [join(scripts, "gym-baseline.sh"), "--scenario", "sample"], {
      env: {
        ...process.env,
        FIXTURE_RESULT: JSON.stringify(value, null, 2),
        FIXTURE_RUNNER_EXIT: String(runner),
        FIXTURE_RECORDER_EXIT: String(recorder),
        FIXTURE_RECORDED: recorded,
      },
      timeout: 10_000,
    }).then(
      ({ stdout }) => ({ code: 0, stdout }),
      (error: { code: number; stdout: string }) => error,
    );
    expect(observed.code).toBe(code);
    expect(observed.stdout).toContain(expected);
    if (record && value && typeof value.passed === "boolean" && !value.checks?.includes(null))
      expect(JSON.parse(readFileSync(recorded, "utf8"))).toEqual(value);
    else expect(existsSync(recorded)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
