/**
 * Stale Reference Cleanup Scorer
 *
 * Tests whether the agent:
 * 1. Fixes the obvious broken import in index.js
 * 2. Finds and fixes ALL stale references (including subtle package.json lint script)
 * 3. Verifies the fix works
 *
 * Design: The index.js import is the obvious fix (app crashes without it).
 * The package.json lint script references the old filename — a careful agent
 * doing `grep -r string-helpers` will find it, but agents that only fix the
 * crash and move on will miss it.
 *
 * Target baseline: 70-85% (most agents grep comprehensively, some don't)
 */
const { Score } = require("@may-agent/gym/scoring");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2] || path.join(__dirname, "environment");
const score = new Score(workDir);

// Resolve paths — handle both direct environment/ and copied work dirs
const srcDir = fs.existsSync(path.join(workDir, "environment", "src"))
  ? path.join(workDir, "environment", "src")
  : path.join(workDir, "src");
const testDir = fs.existsSync(path.join(workDir, "environment", "test"))
  ? path.join(workDir, "environment", "test")
  : path.join(workDir, "test");
const pkgPath = fs.existsSync(path.join(workDir, "environment", "package.json"))
  ? path.join(workDir, "environment", "package.json")
  : path.join(workDir, "package.json");
const runDir = fs.existsSync(path.join(workDir, "environment"))
  ? path.join(workDir, "environment")
  : workDir;

// ── Product checks ──────────────────────────────────────────────────────

score.checkProduct("app-runs", "Application runs without errors (node src/index.js exits 0)", () => {
  try {
    execSync("node src/index.js", { cwd: runDir, timeout: 10000, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
});

score.checkProduct("tests-pass", "All tests pass (node test/index.test.js exits 0)", () => {
  try {
    execSync("node test/index.test.js", { cwd: runDir, timeout: 10000, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
});

score.checkProduct("lint-references-updated", "Package.json lint script references text-processing.js, not string-helpers.js", () => {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const lintScript = (pkg.scripts && pkg.scripts.lint) || "";
  // The lint script should NOT reference the old filename
  const hasStaleRef = lintScript.includes("string-helpers");
  // And should reference the new filename
  const hasNewRef = lintScript.includes("text-processing");
  return !hasStaleRef && hasNewRef;
});

// ── Behavior checks ─────────────────────────────────────────────────────

score.checkBehavior("index-import-fixed", "src/index.js requires text-processing, not string-helpers", () => {
  const indexContent = fs.readFileSync(path.join(srcDir, "index.js"), "utf-8");
  return indexContent.includes("text-processing") && !indexContent.includes("string-helpers");
});

score.checkBehavior("no-stale-references", "No remaining references to 'string-helpers' in any project file", () => {
  // Check all JS files and package.json for any remaining stale references
  // Note: text-processing.js may have a comment documenting its rename history —
  // that's legitimate documentation, not a stale reference. Strip comment lines before checking.
  const filesToCheck = [
    path.join(srcDir, "index.js"),
    path.join(srcDir, "config.js"),
    path.join(srcDir, "utils", "text-processing.js"),
    path.join(srcDir, "utils", "validators.js"),
    path.join(testDir, "index.test.js"),
    pkgPath
  ];
  
  for (const filePath of filesToCheck) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      // For JS files, strip single-line comments before checking —
      // rename history comments are legitimate documentation
      const contentToCheck = filePath.endsWith(".js")
        ? content.split("\n").filter(line => !line.trimStart().startsWith("//")).join("\n")
        : content;
      if (contentToCheck.includes("string-helpers")) {
        return false;
      }
    }
  }
  return true;
});

score.report();
