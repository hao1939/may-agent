import { afterEach, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test.each(["success", "failure", "empty"] as const)(
  "the full-suite command runs every selected file once and propagates failure (%s)",
  async (mode) => {
    const fail = mode === "failure";
    const root = mkdtempSync(join(tmpdir(), "may-test-command-"));
    roots.push(root);
    const witness = join(root, "visited");
    const names = Array.from({ length: 17 }, (_, index) => `case-${index}`);
    for (const name of names) {
      writeFileSync(
        join(root, `${name}.test.ts`),
        `
      import { test, expect } from "bun:test";
      import { appendFileSync } from "node:fs";
      test(${JSON.stringify(name)}, () => {
        appendFileSync(${JSON.stringify(witness)}, ${JSON.stringify(name + "\n")});
        expect(${JSON.stringify(!fail || name !== names[1])}).toBe(true);
      });
    `,
      );
    }
    const args = [
      fileURLToPath(new URL("./test.ts", import.meta.url)),
      root,
      "--reporter=junit",
      ...(fail
        ? [`--reporter-outfile=${join(root, "results.xml")}`]
        : ["--reporter-outfile", join(root, "results.xml")]),
    ];
    let code = 0;
    try {
      await promisify(execFile)(process.execPath, args, {
        timeout: 10_000,
        env: mode === "empty" ? { ...process.env, MAY_TEST_SHARDS: "0" } : process.env,
      });
    } catch (error) {
      code = (error as { code: number }).code;
    }
    expect(code).toBe(mode === "success" ? 0 : 1);
    if (mode === "empty") {
      expect(existsSync(witness)).toBe(false);
      return;
    }
    expect(readFileSync(witness, "utf8").trim().split("\n").sort()).toEqual(names.toSorted());
    const reports = readdirSync(root).filter((name) => /^results\.\d+\.xml$/.test(name));
    const reported = reports.flatMap((name) =>
      [...readFileSync(join(root, name), "utf8").matchAll(/<testcase name="([^"]+)"/g)].map((match) => match[1]),
    );
    expect(reported.sort()).toEqual(names.toSorted());
  },
);
