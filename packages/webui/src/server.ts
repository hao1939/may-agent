#!/usr/bin/env bun
/**
 * Compatibility entrypoint for the WebUI package.
 *
 * The HTTP adapter lives in src/app/http/server.ts because it owns May Agent
 * infra-facing API routes, static serving, daemon socket bridging, and DB read
 * models. packages/webui remains the UI package.
 */
export type { WebUIOptions } from "../../../src/app/http/server.js";
export {
  extractMarkdownSection,
  normalizeProjectPathForCompare,
  projectPathsMatch,
  runWebUIServerFromCli,
  startWebUI,
} from "../../../src/app/http/server.js";

import { runWebUIServerFromCli } from "../../../src/app/http/server.js";

if ((import.meta as ImportMeta & { main?: boolean }).main && process.argv.includes("--state-dir")) {
  runWebUIServerFromCli();
}
