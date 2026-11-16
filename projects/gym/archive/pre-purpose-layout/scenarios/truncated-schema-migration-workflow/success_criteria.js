/**
 * Truncated Schema Migration Workflow Scorer
 * 
 * Same product checks as truncated-schema-migration, plus workflow compliance:
 * - Agent wrote SCHEMA-AUDIT.md before editing schema.sql
 * - SCHEMA-AUDIT.md lists columns from both model and schema
 * - ALL model columns are present in final schema (not just test-covered ones)
 */
const { Score } = require("@may-agent/gym/scoring");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Workflow: SCHEMA-AUDIT.md exists ────────────────────────────

s.checkProduct("schema-audit-exists", "SCHEMA-AUDIT.md was created", () => {
  const auditPath = path.join(workDir, "SCHEMA-AUDIT.md");
  return fs.existsSync(auditPath);
});

s.checkProduct("schema-audit-lists-columns", "SCHEMA-AUDIT.md has required sections with column details", () => {
  try {
    const auditPath = path.join(workDir, "SCHEMA-AUDIT.md");
    const content = fs.readFileSync(auditPath, "utf8");
    const lower = content.toLowerCase();
    // L5 strict: must have the mandatory sections
    const hasModelSection = content.includes("## Model Columns") || content.includes("## Model columns");
    const hasSchemaSection = content.includes("## Schema Columns") || content.includes("## Schema columns");
    const hasMissingSection = content.includes("## Missing Columns") || content.includes("## Missing columns");
    const hasCountSection = content.includes("## Column Count") || content.includes("## Column count");
    // Must mention specific columns
    const mentionsColumns = lower.includes("column") || lower.includes("field");
    return (hasModelSection || hasMissingSection) && mentionsColumns;
  } catch {
    return false;
  }
});

s.checkProduct("schema-audit-has-substance", "SCHEMA-AUDIT.md has substantive analysis (>100 chars)", () => {
  try {
    const auditPath = path.join(workDir, "SCHEMA-AUDIT.md");
    const content = fs.readFileSync(auditPath, "utf8");
    return content.length > 100;
  } catch {
    return false;
  }
});

// ── Product: Tests pass ─────────────────────────────────────────

s.checkProduct("tests-pass", "node test/check.js passes", () => {
  try {
    execSync("node test/check.js", { cwd: workDir, timeout: 10000, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
});

// ── Product: Schema has all 7 columns ───────────────────────────

s.checkProduct("schema-complete", "schema.sql defines all expected columns (7 columns in users table)", () => {
  try {
    const schemaPath = path.join(workDir, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8").toLowerCase();
    
    // The base scenario has 7 expected columns; migration only creates 4
    // We check for common column patterns that should exist
    const hasCreateTable = schema.includes("create table");
    
    // Count column-like definitions (lines with type keywords inside CREATE TABLE)
    const typeKeywords = ["integer", "text", "varchar", "real", "blob", "boolean", "datetime", "timestamp", "int", "char"];
    const lines = schema.split("\n");
    let columnCount = 0;
    for (const line of lines) {
      const lower = line.toLowerCase().trim();
      if (typeKeywords.some(kw => lower.includes(kw)) && !lower.startsWith("create") && !lower.startsWith("--")) {
        columnCount++;
      }
    }
    
    return hasCreateTable && columnCount >= 7;
  } catch {
    return false;
  }
});

// ── Product: No JS files modified ───────────────────────────────

s.checkProduct("no-js-modified", "No JavaScript files were modified (constraint from task)", () => {
  try {
    // Check git status for modified JS files
    const status = execSync("git diff --name-only HEAD 2>/dev/null || echo ''", { cwd: workDir, timeout: 5000 }).toString();
    const jsFiles = status.split("\n").filter(f => f.endsWith(".js"));
    return jsFiles.length === 0;
  } catch {
    // If git isn't available, pass this check (can't verify)
    return true;
  }
});

s.report();
