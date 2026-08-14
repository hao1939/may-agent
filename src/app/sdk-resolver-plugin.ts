/**
 * Bun plugin that maps the public `@may-agent/sdk` entry points
 * bare specifiers to the workspace SDK source files.
 *
 * **Scope: build-time only.** `Bun.plugin()` hooks fire during `Bun.build`
 * (bundler), not during runtime ESM import. This plugin lets the compiled
 * binary statically inline SDK symbols at build time — it does **not**
 * intercept dynamic `import()` from running handlers/workflows. Runtime
 * dynamic-import resolution relies on a normal node_modules entry:
 *
 *   - In `/app/` (production-style host): `file:` dep in /app/package.json
 *     populates `/app/node_modules/@may-agent/sdk`.
 *   - In the repo itself: workspaces directive in
 *     `projects/platform/repos/may-agent/package.json` materializes
 *     `<repo>/node_modules/@may-agent/sdk` as a symlink.
 *   - In e2e sandbox dirs (outside any workspace): the harness symlinks
 *     the SDK into the sandbox's `node_modules` directly.
 *
 * Importing this module is still useful because the binary entry point
 * invokes `Bun.build` indirectly via `--compile`, and we want the SDK
 * resolved consistently in that path.
 */
import { plugin } from "bun";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// This file lives at: <repo>/src/app/sdk-resolver-plugin.ts
// SDK source lives at: <repo>/packages/sdk/src/
// Walk up two levels (src/app -> repo root) then into packages/sdk/src.
const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const SDK_ROOT = resolve(THIS_DIR, "..", "..", "packages", "sdk", "src");

plugin({
  name: "may-agent-sdk-resolver",
  setup(build) {
    build.onResolve({ filter: /^@may-agent\/sdk$/ }, () => ({
      path: resolve(SDK_ROOT, "index.ts"),
    }));
    build.onResolve({ filter: /^@may-agent\/sdk\/app$/ }, () => ({
      path: resolve(SDK_ROOT, "app.ts"),
    }));
    build.onResolve({ filter: /^@may-agent\/sdk\/legacy$/ }, () => ({
      path: resolve(SDK_ROOT, "legacy.ts"),
    }));
    build.onResolve({ filter: /^@may-agent\/sdk\/testing$/ }, () => ({
      path: resolve(SDK_ROOT, "testing.ts"),
    }));
  },
});
