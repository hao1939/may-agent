import { afterEach, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test.each([false, true])(
  "the full-suite command runs every selected file once and propagates failure (%s)",
  async (fail) => {
    const root = mkdtempSync(join(tmpdir(), "may-test-command-"));
    roots.push(root);
    const witness = join(root, "visited");
    for (const name of ["one", "two", "three"]) {
      writeFileSync(
        join(root, `${name}.test.ts`),
        `
      import { test, expect } from "bun:test";
      import { appendFileSync } from "node:fs";
      test(${JSON.stringify(name)}, () => {
        appendFileSync(${JSON.stringify(witness)}, ${JSON.stringify(name + "\n")});
        expect(${JSON.stringify(!fail || name !== "two")}).toBe(true);
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
      await promisify(execFile)(process.execPath, args, { timeout: 10_000 });
    } catch (error) {
      code = (error as { code: number }).code;
    }
    expect(code).toBe(fail ? 1 : 0);
    expect(readFileSync(witness, "utf8").trim().split("\n").sort()).toEqual(["one", "three", "two"]);
    const reports = readdirSync(root).filter((name) => /^results\.\d+\.xml$/.test(name));
    expect(reports).toHaveLength(2);
    expect(reports.flatMap((name) => [...readFileSync(join(root, name), "utf8").matchAll(/<testcase /g)])).toHaveLength(
      3,
    );
  },
);
