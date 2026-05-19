/**
 * Bun plugin that resolves `@may-agent/sdk` (and `@may-agent/sdk/testing`)
 * bare specifiers to the workspace SDK source files.
 *
 * Purpose: dynamically-loaded files (handlers under agents/<name>, workflows
 * under agents/<name>/workflows or projects/<name>/workflows) need to import the SDK by its
 * package name. In the compiled binary the bare specifier cannot resolve via
 * node_modules (the binary doesn't ship node_modules in a normal layout). In
 * dev mode the bare specifier resolves only if a node_modules entry exists,
 * which depends on having run `bun install` against a workspace.
 *
 * Registering this plugin in BOTH the compiled binary entry and the dev-mode
 * entry (`may.ts`) makes the bare specifier work the same way everywhere:
 * directly from the SDK source files. No node_modules, no relative re-export
 * bridge.
 *
 * Side effect: importing this module registers the plugin globally for the
 * current Bun process. Import it as early as possible — before any
 * dynamically-loaded handler or workflow is imported.
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
    build.onResolve({ filter: /^@may-agent\/sdk\/testing$/ }, () => ({
      path: resolve(SDK_ROOT, "testing.ts"),
    }));
  },
});
