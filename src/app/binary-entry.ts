/**
 * Binary entry point — compilation target for `bun build --compile`.
 *
 * This is the switchboard that routes between launcher (supervisor) and
 * may.ts (worker) modes when running as a compiled binary.
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

  if (process.env.MAY_ROLE === "child" || process.argv.includes("--oneshot")) {
    // Worker mode or oneshot: run may.ts logic directly
    await import("./may.js");
  } else {
    // Supervisor mode: run launcher
    await import("./launcher.js");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
