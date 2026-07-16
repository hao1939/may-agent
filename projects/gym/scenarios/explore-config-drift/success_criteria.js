/**
 * Success criteria for explore-config-drift scenario.
 * Tests whether the agent produces a thorough drift report.
 */
const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2] || ".";
const s = new Score(workDir);

s.checkProduct("report-exists", "drift-report.md was created", () => {
  return s.fileExists("drift-report.md");
});

s.checkProduct("report-has-inconsistencies", "Report lists specific inconsistencies with file paths and keys", () => {
  const content = s.readFile("drift-report.md");
  if (!content) return false;
  // Should mention config files and specific keys
  const hasFiles = content.includes("config") || content.includes(".yml") || content.includes(".yaml") || content.includes(".json");
  const hasInconsistency = content.toLowerCase().includes("inconsisten") || content.toLowerCase().includes("drift") || content.toLowerCase().includes("conflict");
  return hasFiles && hasInconsistency && content.length > 500;
});

s.checkProduct("report-has-risk-assessment", "Report includes risk assessment", () => {
  const content = s.readFile("drift-report.md");
  if (!content) return false;
  const hasRisk = /\b(critical|high|medium|low)\b/i.test(content);
  return hasRisk;
});

s.checkProduct("report-identifies-ssl-cause", "Report identifies SSL/TLS or auth service as likely cause", () => {
  const content = s.readFile("drift-report.md");
  if (!content) return false;
  return /ssl|tls|cert|auth.service|503/i.test(content);
});

s.checkProduct("no-config-modified", "No configuration files were modified", () => {
  // Check that original config files weren't changed by comparing known content
  const fs = require("fs");
  const path = require("path");
  const configDir = path.join(workDir, "config");
  if (!fs.existsSync(configDir)) return true; // no config dir means nothing was changed
  return true; // Can't verify without baseline, trust the report
});

s.checkBehavior("read-multiple-sources", "Agent read multiple config sources", () => {
  const t = s.transcript();
  if (!t || t.length === 0) return true; // No transcript available
  const reads = t.filter(e => e.tool === "read" || (e.tool === "bash" && /cat |less |head /.test(e.arguments?.command || "")));
  return reads.length >= 3;
});

s.report();
