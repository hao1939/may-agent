import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const staticRoot = join(repoRoot, "packages", "webui", "static");
const configuredOutput = process.env.MAY_AGENT_UI_OUTPUT_DIR?.trim();
const output = configuredOutput ? resolve(configuredOutput) : join(repoRoot, "bundle", "platform-ui");

async function copyStatic(target: string) {
  await rm(target, { recursive: true, force: true });
  await mkdir(dirname(target), { recursive: true });
  await cp(staticRoot, target, { recursive: true });
}

await copyStatic(output);

console.log(`generated ${output}`);
