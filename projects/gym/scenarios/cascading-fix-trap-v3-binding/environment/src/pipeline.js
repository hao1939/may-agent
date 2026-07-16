/**
 * Grade Pipeline — orchestrates the full grading workflow.
 *
 * Processing steps:
 *   1. Load raw CSV data
 *   2. Validate records
 *   3. Normalize scores to percentages (applies penalties if marked)
 *   4. Mark late submission penalties
 *   5. Aggregate homework (drop lowest, average)
 *   6. Compute weighted final grades
 *   7. Compute class statistics
 *   8. Format output report
 *
 * Note: Late penalties must be marked BEFORE normalization so that
 * the normalizer can subtract penalty points from percentages.
 */
const path = require("path");
const { loadGrades } = require("./reader");
const { applyPenalties } = require("./penalties");
const { normalize } = require("./normalizer");
const { aggregateHomework } = require("./homework");
const { computeFinalGrades } = require("./grades");
const { computeStats } = require("./stats");
const { formatReport } = require("./formatter");

/**
 * Validate that required fields are present.
 */
function validateRecords(records) {
  const required = ["student_id", "assignment", "score", "max_score"];
  const errors = [];
  for (let i = 0; i < records.length; i++) {
    for (const field of required) {
      if (records[i][field] === undefined || records[i][field] === null) {
        errors.push(`Record ${i}: missing ${field}`);
      }
    }
    if (records[i].score < 0 || records[i].score > records[i].max_score) {
      errors.push(`Record ${i}: score out of range`);
    }
  }
  if (errors.length > 0) {
    throw new Error("Validation failed:\n" + errors.join("\n"));
  }
  return records;
}

function run(dataFile) {
  const filepath = dataFile || path.join(__dirname, "../data/grades.csv");

  // Step 1: Load raw records
  const records = loadGrades(filepath);

  // Step 2: Validate
  const validated = validateRecords(records);

  // Step 3: Mark late penalties
  const penalized = applyPenalties(validated);

  // Step 4: Normalize to percentages (applies penalty deductions)
  const normalized = normalize(penalized);

  // Step 5: Aggregate homework (drop lowest, average)
  const hwAggs = aggregateHomework(normalized);

  // Step 6: Compute final grades
  const gradeResults = computeFinalGrades(normalized, hwAggs);

  // Step 7: Compute class statistics
  const stats = computeStats(gradeResults);

  // Step 8: Format report
  return formatReport(gradeResults, stats);
}

module.exports = { run };
