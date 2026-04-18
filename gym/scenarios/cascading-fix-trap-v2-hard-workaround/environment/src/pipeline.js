/**
 * Grade Pipeline — orchestrates the full grading workflow.
 *
 * Processing steps:
 *   1. Load raw CSV data
 *   2. Validate records
 *   3. Normalize scores to percentages
 *   4. Apply late submission penalties
 *   5. Verify normalization integrity
 *   6. Aggregate homework (drop lowest, average)
 *   7. Compute weighted final grades
 *   8. Compute class statistics
 *   9. Format output report
 *
 * Note: Normalization must precede penalty application so that
 * penalty deductions are expressed in percentage points (not raw points).
 *
 * Integrity checks run between stages to catch data corruption early.
 */
const path = require("path");
const { loadGrades } = require("./reader");
const { applyPenalties } = require("./penalties");
const { normalize, verifyNormIntegrity } = require("./normalizer");
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

  // Step 3: Normalize to percentages
  const normalized = normalize(validated);

  // Step 4: Apply late penalties
  const penalized = applyPenalties(normalized);

  // Step 4b: Re-normalize after penalties so pct reflects adjusted scores
  const renormalized = normalize(penalized);

  // Step 5: Verify normalization integrity before downstream use
  verifyNormIntegrity(renormalized, "post-penalties");

  // Step 6: Aggregate homework (drop lowest, average)
  const hwAggs = aggregateHomework(renormalized);

  // Step 7: Compute final grades
  const gradeResults = computeFinalGrades(renormalized, hwAggs);

  // Step 8: Compute class statistics
  const stats = computeStats(gradeResults);

  // Step 9: Format report
  return formatReport(gradeResults, stats);
}

module.exports = { run };
