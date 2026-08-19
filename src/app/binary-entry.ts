/**
 * Binary entry point — compilation target for `bun build --compile`.
 *
 * Runs may.ts directly. Process supervision is handled by supervisord
 * (container) or the OS process manager. No internal launcher layer.
 *
 * Bun compiled argv is [runtime, binaryPath, arg1, ...] (offset 2), matching
 * development's [runtime, script, arg1, ...]. Replace only the entry label so
 * may.ts sees the same operator arguments in both modes.
 */

import { plugin } from "bun";
import { isBundled } from "./bundle-mode.js";
import "./sdk-resolver-plugin.js";

// SDK resolver plugin is registered as a side effect of the import above.
// It bridges `@may-agent/sdk` bare specifiers from dynamically-loaded
// handler/workflow files to the workspace SDK source. The plugin is now
// shared with may.ts (dev mode) so both code paths resolve identically.
//
// `plugin` is still imported above for any future binary-only plugins.
void plugin;

async function main() {
  if (!isBundled()) {
    console.error("binary-entry.ts should only run in compiled mode. Use bun src/app/may.ts for dev.");
    process.exit(1);
  }

  // Normalize argv without leaking the compiled executable path as an argument.
  process.argv = [process.argv[0], "binary-entry.ts", ...process.argv.slice(2)];

  // Run may.ts directly — no launcher layer
  await import("./may.js");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
