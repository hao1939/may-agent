/**
 * Tool preset registry.
 *
 * The allowlist validates agent definitions. The loader integration test checks
 * wiring by building these presets through the real loader.
 * A preset in VALID_TOOL_PRESETS must either have a buildTools() case or be
 * removed from agent.json/docs.
 */

export const VALID_TOOL_PRESETS = new Set([
  "coding",
  "read-only",
  "agents",
  "workflow",
  "finish",
  "checkpoint",
  "cli-delegation",
  "query_db",
]);
