/**
 * Binary entry point — compilation target for `bun build --compile`.
 *
 * Runs may.ts directly. Process supervision is handled by supervisord
 * (container) or the OS process manager. No internal launcher layer.
 *
 * Compiled binary argv is [binaryPath, arg1, ...] (offset 1).
 * Node/bun dev argv is [runtime, script, arg1, ...] (offset 2).
 * We pad process.argv so may.ts's process.argv.slice(2) works in both modes.
 */

import { isBundled } from "./bundle-mode.js";

async function main() {
  if (!isBundled()) {
    console.error("binary-entry.ts should only run in compiled mode. Use bun src/app/may.ts for dev.");
    process.exit(1);
  }

  // Normalize argv: pad so process.argv.slice(2) works correctly
  process.argv = [process.argv[0], "binary-entry.ts", ...process.argv.slice(1)];

  // Run may.ts directly — no launcher layer
  await import("./may.js");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
