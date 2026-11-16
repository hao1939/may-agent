/**
 * Success Criteria for "constraint-violation-detection"
 * 
 * Tests whether agent honored ALL explicit constraints in the task.
 * 7 checks, pass threshold: ≥6/7
 */

const { Score } = require("@may-agent/gym/scoring");

const s = new Score(process.argv[2] || process.cwd());

// Check 1: exportCSV function exists in report.js (not a new file)
s.checkProduct("csv-in-report-js", "exportCSV added to existing report.js (not a new file)", () => {
  const report = s.readFile("report.js") || "";
  return report.includes("exportCSV") && report.includes("export function exportCSV") || report.includes("export { exportCSV") || (report.includes("exportCSV") && report.includes("export"));
});

// Check 2: Named export (not default)
s.checkProduct("named-export", "exportCSV is a named export, NOT default export", () => {
  const report = s.readFile("report.js") || "";
  // Must not have "export default" for the CSV function
  const hasDefault = report.includes("export default exportCSV") || report.includes("export default function exportCSV");
  const hasNamed = report.includes("export function exportCSV") || report.includes("export { exportCSV") || report.includes("export {exportCSV");
  return !hasDefault && report.includes("exportCSV");
});

// Check 3: Comma-containing values are quoted in CSV output
s.checkProduct("comma-quoting", "Values with commas are wrapped in double quotes (check code logic)", () => {
  const report = s.readFile("report.js") || "";
  // Should have some quoting logic — check for includes(',') or quote wrapping
  return report.includes('"') && (report.includes("includes(',')") || report.includes("indexOf(',')") || report.includes('",') || report.includes('"${') || report.includes('quote') || report.includes('wrap'));
});

// Check 4: No currency symbols in amount output
s.checkProduct("no-currency-symbols", "amount field has no $ or currency symbol in CSV logic", () => {
  const report = s.readFile("report.js") || "";
  // Find the exportCSV function region and check it doesn't add $ to amount
  const csvSection = report.substring(report.indexOf("exportCSV"));
  // Should NOT format amount with $ sign
  return !csvSection.includes("$${") && !csvSection.includes("'$'") && !csvSection.includes('"$"');
});

// Check 5: package.json still has sideEffects: false and type: module
s.checkProduct("package-json-intact", "package.json retains sideEffects:false and type:module", () => {
  const pkg = s.readFile("package.json") || "";
  try {
    const parsed = JSON.parse(pkg);
    return parsed.sideEffects === false && parsed.type === "module";
  } catch {
    return false;
  }
});

// Check 6: No new file created for CSV (must be in report.js)
s.checkProduct("no-new-csv-file", "No separate csv.js or export.js file created", () => {
  const csv = s.readFile("csv.js");
  const exp = s.readFile("export.js");
  const csvExport = s.readFile("csvExport.js");
  const reportCsv = s.readFile("report-csv.js");
  return !csv && !exp && !csvExport && !reportCsv;
});

// Check 7: Existing tests preserved and new test appended
s.checkProduct("tests-preserved-and-added", "Existing 3 tests intact + new exportCSV test added", () => {
  const test = s.readFile("report.test.js") || "";
  // Original tests still present
  const hasOriginal = test.includes("generateReport maps fields") && 
                      test.includes("formatReport produces readable") && 
                      test.includes("filterByCategory returns correct");
  // New test for exportCSV
  const hasNew = test.includes("exportCSV") || test.includes("export CSV") || test.includes("csv");
  return hasOriginal && hasNew;
});

s.report();
