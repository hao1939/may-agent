import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { prepareAgentExecution } from "@may-agent/sdk/runtime";
import { fakeModel } from "../../../test/fixtures/model.js";

const execFileAsync = promisify(execFile);

test("public SDK entrypoints preserve the reviewed value and type exports", async () => {
  const repoRoot = resolve(import.meta.dir, "../../..");
  const outputDir = await mkdtemp(join(tmpdir(), "sdk-declarations-"));
  try {
    // Use the public CLI, not compiler internals. Declaration output retains
    // type-only exports that a runtime import cannot inspect.
    await execFileAsync(
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
    for (const [declaration, snapshot] of [
      ["src/index.d.ts", "test/fixtures/sdk-root.d.ts.snap"],
      ["src/app.d.ts", "test/fixtures/sdk-app.d.ts.snap"],
      ["src/command.d.ts", "test/fixtures/sdk-command.d.ts.snap"],
      ["src/testing.d.ts", "test/fixtures/sdk-testing.d.ts.snap"],
      ["src/standalone.d.ts", "test/fixtures/sdk-standalone.d.ts.snap"],
    ] as const) {
      const actual = await readFile(join(outputDir, declaration), "utf8");
      const expected = await readFile(join(repoRoot, snapshot), "utf8");
      expect(actual).toBe(expected);
    }
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
}, 30_000);

test("runtime prompts load the actual execution instruction text", async () => {
  const repoRoot = resolve(import.meta.dir, "../../..");
  const instructionText = (
    await readFile(join(repoRoot, "packages/sdk/src/runtime/lib/execution-instructions.md"), "utf8")
  ).trim();
  const prepared = prepareAgentExecution({
    definition: {
      name: "instruction-text-probe",
      description: "fixture",
      domain: "test",
      model: fakeModel(),
      tools: [],
      systemPrompt: "Consumer prompt",
    },
    projectRoot: repoRoot,
    sessionId: "instruction-text-probe",
    task: "Compile the consumer",
  });

  expect(prepared.systemPrompt).toContain(`<execution_instructions>\n${instructionText}\n</execution_instructions>`);
});

test("independent TypeScript consumers compile the public runtime entrypoints", async () => {
  const repoRoot = resolve(import.meta.dir, "../../..");
  const consumerRoot = await mkdtemp(join(tmpdir(), "sdk-consumer-"));
  try {
    // Resolve the package's real exports, not a second map of source aliases.
    await mkdir(join(consumerRoot, "node_modules/@may-agent"), { recursive: true });
    await symlink(join(repoRoot, "packages/sdk"), join(consumerRoot, "node_modules/@may-agent/sdk"), "dir");
    await writeFile(join(consumerRoot, "package.json"), JSON.stringify({ type: "module" }));
    await writeFile(
      join(consumerRoot, "consumer.ts"),
      `
        import * as sdk from "@may-agent/sdk";
        import * as app from "@may-agent/sdk/app";
        import * as command from "@may-agent/sdk/command";
        import * as standalone from "@may-agent/sdk/standalone";
        import * as testing from "@may-agent/sdk/testing";
        import * as runtime from "@may-agent/sdk/runtime";

        export { sdk, app, command, standalone, testing, runtime };
      `,
    );
    for (const [module, moduleResolution] of [
      ["ESNext", "Bundler"],
      ["NodeNext", "NodeNext"],
    ] as const) {
      await writeFile(
        join(consumerRoot, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module,
            moduleResolution,
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            types: ["node"],
            typeRoots: [join(repoRoot, "node_modules/@types")],
          },
          files: ["consumer.ts"],
        }),
      );

      try {
        await execFileAsync(
          join(repoRoot, "node_modules/.bin/tsc"),
          ["--project", join(consumerRoot, "tsconfig.json"), "--pretty", "false"],
          { cwd: consumerRoot, timeout: 20_000, killSignal: "SIGKILL" },
        );
      } catch (error) {
        const failure = error as Error & { stdout?: string; stderr?: string };
        throw new Error(
          [`Independent SDK consumer compilation failed (${moduleResolution}).`, failure.stdout, failure.stderr]
            .filter(Boolean)
            .join("\n"),
          { cause: error },
        );
      }
    }
  } finally {
    await rm(consumerRoot, { recursive: true, force: true });
  }
}, 30_000);
