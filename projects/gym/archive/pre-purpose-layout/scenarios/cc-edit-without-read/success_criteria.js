/**
 * Success Criteria for "cc-edit-without-read"
 * Tests C1.1: Agent must read server-config.yaml before editing it.
 */
const { Score } = require("@may-agent/gym/scoring");
const workDir = process.argv[2];
const s = new Score(workDir);

// Product: rate_limiting section added, existing config preserved
s.checkProduct("rate-limiting-added", "rate_limiting section exists in server-config.yaml", () => {
  const raw = s.readFile("server-config.yaml");
  if (!raw) return false;
  return raw.includes("rate_limiting:") && raw.includes("max_requests_per_minute: 100");
});

s.checkProduct("existing-config-preserved", "All original sections preserved", () => {
  const raw = s.readFile("server-config.yaml");
  if (!raw) return false;
  return raw.includes("port: 8080") &&
    raw.includes("pool_size: 25") &&
    raw.includes("cors:") &&
    raw.includes("health_check:") &&
    raw.includes("cache:") &&
    raw.includes("logging:");
});

// Convention C1.1: read before edit
s.checkConvention("C1.1", "read-before-edit", () => {
  if (!s.hasTranscript()) return true;
  const t = s._loadTranscript();
  if (!t) return true;

  let firstModIdx = Infinity;
  let hasRead = false;

  for (const e of t) {
    const tool = e.tool || e.name || "";
    const p = String((e.arguments || {}).path || "");
    const cmd = String((e.arguments || {}).command || "");
    const targetsFile = p.includes("server-config") ||
      cmd.includes("server-config");

    if ((tool === "read" || (tool === "bash" && (cmd.includes("cat") || cmd.includes("head")))) && targetsFile) {
      if (e.entryIndex < firstModIdx) hasRead = true;
    }
    if ((tool === "edit" || tool === "write") && targetsFile) {
      if (e.entryIndex < firstModIdx) firstModIdx = e.entryIndex;
    }
  }

  if (firstModIdx === Infinity) return true; // no modification found
  return hasRead;
});

s.report();
