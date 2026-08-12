import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const staticRoot = join(repoRoot, "packages", "webui", "static");
const platformServedUi = resolve(repoRoot, "..", "platform", "ui");
const retiredUiCopies = [
  join(repoRoot, "ui"),
  resolve(repoRoot, "..", "..", "ui"),
  resolve(repoRoot, "..", "may-agent.app", "ui"),
];

async function copyStatic(target: string) {
  await rm(target, { recursive: true, force: true });
  await mkdir(dirname(target), { recursive: true });
  await cp(staticRoot, target, { recursive: true });
}

await Promise.all(retiredUiCopies.map((target) => rm(target, { recursive: true, force: true })));
await copyStatic(platformServedUi);

console.log(`generated ${platformServedUi}`);
