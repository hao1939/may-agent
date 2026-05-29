import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const staticRoot = join(repoRoot, "packages", "webui", "static");
const nodeModulesRoot = join(repoRoot, "node_modules");
const generatedUi = join(repoRoot, "ui");
const servedUi = resolve(repoRoot, "..", "..", "ui");

async function syncVendorAssets() {
  const vendorRoot = join(staticRoot, "vendor", "xterm");
  await rm(vendorRoot, { recursive: true, force: true });
  await mkdir(vendorRoot, { recursive: true });
  await cp(join(nodeModulesRoot, "@xterm", "xterm", "lib", "xterm.js"), join(vendorRoot, "xterm.js"));
  await cp(join(nodeModulesRoot, "@xterm", "xterm", "css", "xterm.css"), join(vendorRoot, "xterm.css"));
  await cp(join(nodeModulesRoot, "@xterm", "addon-fit", "lib", "addon-fit.js"), join(vendorRoot, "addon-fit.js"));
}

async function copyStatic(target: string) {
  await rm(target, { recursive: true, force: true });
  await mkdir(dirname(target), { recursive: true });
  await cp(staticRoot, target, { recursive: true });
}

await syncVendorAssets();
await copyStatic(generatedUi);
await copyStatic(servedUi);

console.log(`generated ${generatedUi}`);
console.log(`generated ${servedUi}`);
