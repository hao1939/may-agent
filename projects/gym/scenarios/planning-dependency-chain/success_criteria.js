/**
 * Success Criteria for "planning-dependency-chain"
 * 
 * 12 product checks — one per task item.
 * Pass threshold: ≥9/12
 */

const { Score } = require("@may-agent/gym/scoring");

const s = new Score(process.argv[2] || process.cwd());

// Check 1: config.json has port 3000
s.checkProduct("config-port-fixed", "config.json has port 3000", () => {
  const config = s.readFile("config.json") || "";
  return config.includes('"port"') && config.includes('3000');
});

// Check 2: build.sh references config.json or uses jq
s.checkProduct("build-reads-config", "build.sh reads port from config.json", () => {
  const build = s.readFile("build.sh") || "";
  return build.includes('config.json') || build.includes('jq');
});

// Check 3: deploy.yaml exists with containerPort 3000
s.checkProduct("deploy-yaml-exists", "deploy.yaml has containerPort 3000", () => {
  const deploy = s.readFile("deploy.yaml") || "";
  return deploy.includes('containerPort') && deploy.includes('3000');
});

// Check 4: deploy.yaml has health check
s.checkProduct("deploy-health-check", "deploy.yaml has /health check", () => {
  const deploy = s.readFile("deploy.yaml") || "";
  return deploy.includes('health') && deploy.includes('/health');
});

// Check 5: parse.js fixed (slice(1) instead of slice(2))
s.checkProduct("parse-fix", "parse.js uses .slice(1) not .slice(2)", () => {
  const parse = s.readFile("parse.js") || "";
  return parse.includes('.slice(1)') && !parse.includes('.slice(2)');
});

// Check 6: transform.js exists and imports parse
s.checkProduct("transform-exists", "transform.js imports parse and adds timestamp", () => {
  const transform = s.readFile("transform.js") || "";
  return transform.includes('parse') && transform.includes('timestamp');
});

// Check 7: schema.json exists with proper structure
s.checkProduct("schema-exists", "schema.json validates timestamp and name", () => {
  const schema = s.readFile("schema.json") || "";
  return schema.includes('timestamp') && schema.includes('name');
});

// Check 8: test.js exists and imports transform
s.checkProduct("test-exists", "test.js imports transform and uses data.csv", () => {
  const test = s.readFile("test.js") || "";
  return test.includes('transform') && test.includes('data.csv');
});

// Check 9: CHANGELOG has 2.1.0 section
s.checkProduct("changelog-updated", "CHANGELOG.md has 2.1.0 with port and CSV", () => {
  const changelog = s.readFile("CHANGELOG.md") || "";
  return changelog.includes('2.1.0') && changelog.includes('port') && changelog.includes('CSV');
});

// Check 10: README port updated
s.checkProduct("readme-port-updated", "README.md shows 3000, not 8080", () => {
  const readme = s.readFile("README.md") || "";
  return readme.includes('3000') && !readme.includes('8080');
});

// Check 11: MIGRATION.md exists with required content
s.checkProduct("migration-exists", "MIGRATION.md mentions 3000 and timestamp", () => {
  const migration = s.readFile("MIGRATION.md") || "";
  return migration.includes('3000') && migration.includes('timestamp');
});

// Check 12: release-notes.md exists with substance
s.checkProduct("release-notes-exists", "release-notes.md exists with port mention", () => {
  const releaseNotes = s.readFile("release-notes.md") || "";
  return releaseNotes.length > 50 && releaseNotes.includes('port');
});

s.report();
