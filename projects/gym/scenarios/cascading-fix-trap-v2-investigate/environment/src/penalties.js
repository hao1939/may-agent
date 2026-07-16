/**
 * Late Penalty Calculator
 *
 * Applies late submission penalties to raw scores.
 * Penalty is deducted from the PERCENTAGE score, not raw points.
 *
 * NOTE: Each record gets a `penalty_applied` field (number) and
 * an `adjusted_pct` field with the post-penalty percentage.
 * The `score` field is updated to reflect the new raw-point equivalent.
 */
const policy = require("./policy");

function applyLatePenalty(record) {
  if (record.late_days <= 0) {
    return {
      ...record,
      penalty_applied: 0,
      adjusted_pct: (record.score / record.max_score) * 100,
    };
  }

  const rawPct = (record.score / record.max_score) * 100;
  const penalty = Math.min(
    record.late_days * policy.late_penalty_per_day,
    policy.max_late_penalty
  );

  // Deduct penalty from percentage, then convert back to points
  const adjustedPct = Math.max(0, rawPct - penalty);
  const adjustedScore = (adjustedPct / 100) * record.max_score;

  return {
    ...record,
    original_score: record.score,
    score: Math.round(adjustedScore * 100) / 100,
    penalty_applied: penalty,
    adjusted_pct: Math.round(adjustedPct * 100) / 100,
  };
}

function applyPenalties(records) {
  return records.map(applyLatePenalty);
}

module.exports = { applyPenalties, applyLatePenalty };
