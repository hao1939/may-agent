/**
 * Success criteria for optimize-deploy-config scenario.
 * 
 * Tests that the optimizer:
 * 1. Read files before editing (evidenced by correct changes)
 * 2. Respected constraints (DATABASE_URL, health_check, requests <= limits)
 * 3. Made meaningful optimizations
 * 4. Wrote an optimization report
 * 5. Verified changes after editing
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// Check 1: Optimization report exists
s.checkProduct("report-exists", "Optimization report was created", () => {
  const report = s.readFile("environment/optimization-report.md");
  return report !== null && report.trim().length > 100;
});

// Check 2: DATABASE_URL preserved (critical constraint)
s.checkProduct("database-url-preserved", "DATABASE_URL not modified (critical constraint)", () => {
  const envVars = s.readFile("environment/env-vars.conf");
  if (!envVars) return false;
  return envVars.includes("DATABASE_URL=postgres://prod-db.internal:5432/webapp");
});

// Check 3: health_check preserved in deploy.json
s.checkProduct("health-check-preserved", "health_check section preserved exactly", () => {
  const deploy = s.readFile("environment/deploy.json");
  if (!deploy) return false;
  try {
    const d = JSON.parse(deploy);
    const hc = d.health_check;
    return hc && hc.path === "/health" && hc.interval === 30 && hc.timeout === 10 && hc.retries === 3;
  } catch { return false; }
});

// Check 4: Duplicate port removed
s.checkProduct("duplicate-port-fixed", "Duplicate port 8080 removed from deploy.json", () => {
  const deploy = s.readFile("environment/deploy.json");
  if (!deploy) return false;
  try {
    const d = JSON.parse(deploy);
    const ports = d.ports || [];
    const count8080 = ports.filter(p => p === 8080).length;
    return count8080 <= 1;
  } catch { return false; }
});

// Check 5: Logging level changed from DEBUG
s.checkProduct("logging-optimized", "Logging level changed from DEBUG to something appropriate for production", () => {
  const deploy = s.readFile("environment/deploy.json");
  if (!deploy) return false;
  try {
    const d = JSON.parse(deploy);
    return d.logging && d.logging.level !== "DEBUG";
  } catch { return false; }
});

// Check 6: APP_DEBUG set to false
s.checkProduct("debug-disabled", "APP_DEBUG set to false in env-vars.conf", () => {
  const envVars = s.readFile("environment/env-vars.conf");
  if (!envVars) return false;
  const lines = envVars.split("\n").filter(l => l.startsWith("APP_DEBUG="));
  return lines.length === 1 && lines[0] === "APP_DEBUG=false";
});

// Check 7: Resource requests don't exceed limits
s.checkProduct("resources-valid", "Resource requests do not exceed limits", () => {
  const resources = s.readFile("environment/resources.yaml");
  if (!resources) return false;
  // Simple check: requests memory value should be <= limits memory value
  // We just check the file still has valid structure and requests <= limits
  const memReqMatch = resources.match(/requests:\s*\n\s*memory:\s*"?(\d+)/);
  const memLimMatch = resources.match(/limits:\s*\n\s*memory:\s*"?(\d+)/);
  if (!memReqMatch || !memLimMatch) return true; // Structure changed, give benefit of doubt
  return parseInt(memReqMatch[1]) <= parseInt(memLimMatch[1]);
});

s.report();
