import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

test("public SDK root preserves the reviewed value and type exports", async () => {
  const repoRoot = resolve(import.meta.dir, "../../..");
  const outputDir = await mkdtemp(join(tmpdir(), "sdk-declarations-"));
  try {
    // Use the public CLI, not compiler internals. Declaration output retains
    // type-only exports that a runtime import cannot inspect.
    await promisify(execFile)(
      join(repoRoot, "node_modules/.bin/tsc"),
      [
        "--project",
        "packages/sdk/tsconfig.json",
        "--noEmit",
        "false",
        "--emitDeclarationOnly",
        "--declarationMap",
        "false",
        "--noEmitOnError",
        "--outDir",
        outputDir,
        "--pretty",
        "false",
      ],
      { cwd: repoRoot, timeout: 20_000, killSignal: "SIGKILL" },
    );
    const actual = await readFile(join(outputDir, "packages/sdk/src/index.d.ts"), "utf8");
    const expected = await readFile(join(repoRoot, "test/fixtures/sdk-root.d.ts.snap"), "utf8");
    expect(actual).toBe(expected);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
}, 30_000);
