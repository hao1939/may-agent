import { importRuntimeModule } from "../../packages/sdk/src/runtime/index.js";

// No preloaded App/SDK: isolate Bun's bundler from the test runner's module cache.
const mod = await importRuntimeModule<{ default: { id: string } }>(process.argv[2]!, {
  forceBundle: true,
  cacheDir: process.argv[3]!,
});
console.log(mod.default.id);
