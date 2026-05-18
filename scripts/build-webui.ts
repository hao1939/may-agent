import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const staticRoot = join(repoRoot, "packages", "webui", "static");
const generatedUi = join(repoRoot, "ui");
const servedUi = resolve(repoRoot, "..", "..", "ui");

async function copyStatic(target: string) {
  await rm(target, { recursive: true, force: true });
  await mkdir(dirname(target), { recursive: true });
  await cp(staticRoot, target, { recursive: true });
}

await copyStatic(generatedUi);
await copyStatic(servedUi);

console.log(`generated ${generatedUi}`);
console.log(`generated ${servedUi}`);
