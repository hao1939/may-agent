import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("production Alex watcher follows one delivery Task through CI/comment feedback and recovery", () => {
  const root = mkdtempSync(join(tmpdir(), "alex-task-pr-composition-"));
  try {
    // The explicit maintained checkout is also required by other App contract
    // tests. Never search unrelated directories or use a running installation.
    const host = realpathSync(resolve(import.meta.dirname, "../../may-agent"));
    const output = join(root, "report.json");
    execFileSync(
      "bun",
      [
        resolve(
          import.meta.dirname,
          "../scripts/task-pr-watcher-composition.ts",
        ),
        output,
      ],
      {
        env: { ...process.env, HOST_CANDIDATE: host },
        timeout: 20_000,
        maxBuffer: 2 * 1024 * 1024,
        stdio: "pipe",
      },
    );
    const report = JSON.parse(readFileSync(output, "utf8"));
    expect(report.passed).toBe(7);
    expect(
      report.checks.some((check: string) =>
        check.includes("failed-publication retry"),
      ),
    ).toBe(true);
    expect(
      report.checks.some((check: string) =>
        check.includes("rearms feedback on the original Task"),
      ),
    ).toBe(true);
    expect(
      report.checks.some((check: string) =>
        check.includes("independent requirement returns"),
      ),
    ).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 25_000);
