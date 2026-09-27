import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function command(args: string[], cwd: string) {
  const child = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe", timeout: 20_000 });
  try {
    const [stdout, stderr, status] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (status !== 0) throw new Error(`Exit ${status}: ${stderr}\n${stdout}`);
    return stdout;
  } finally {
    if (child.exitCode === null) child.kill();
    await child.exited;
  }
}

test("compiled preparation includes Host instructions without installation prompt files", async () => {
  const root = mkdtempSync(join(tmpdir(), "execution-build-"));
  try {
    const entry = join(root, "probe.ts");
    const binary = join(root, "probe");
    const preparationModule = new URL("../../src/lib/agent-execution.ts", import.meta.url).pathname;
    writeFileSync(
      entry,
      `
      import { prepareAgentExecution } from ${JSON.stringify(preparationModule)};
      const prepared = prepareAgentExecution({
        definition: {
          name: "fixture", description: "fixture", domain: "test", model: {}, tools: [],
          systemPrompt: "App-owned identity",
          contextPreparation: () => "App-owned brief",
        },
        projectRoot: process.cwd(), sessionId: "fixture", task: "Original assignment",
      });
      console.log(JSON.stringify({ system: prepared.systemPrompt, task: prepared.task, prompt: prepared.prompt }));
    `,
    );
    await command([process.execPath, "build", entry, "--compile", "--outfile", binary], root);
    rmSync(entry);
    const result = JSON.parse(await command([binary], root));
    expect(result.system).toContain("App-owned identity");
    expect(result.system).toContain("<execution_instructions>");
    expect(result.system).toContain("a helper still owes only its assigned contribution");
    expect(result.task).toBe("Original assignment");
    expect(result.prompt).toBe("App-owned brief");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
