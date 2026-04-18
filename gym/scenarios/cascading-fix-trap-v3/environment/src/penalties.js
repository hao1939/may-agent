/**
 * Late Penalty Marker
 *
 * Marks records with late submission penalty information.
 * The actual penalty deduction is applied during normalization,
 * since penalties are expressed as PERCENTAGE POINTS.
 *
 * This module only determines the penalty amount; it does NOT
 * modify scores or compute percentages.
 */
const policy = require("./policy");

function markPenalty(record) {
  if (record.late_days <= 0) {
    return {
      ...record,
      penalty_applied: 0,
    };
  }

  const penalty = Math.min(
    record.late_days * policy.late_penalty_per_day,
    policy.max_late_penalty
  );

  return {
    ...record,
    penalty_applied: penalty,
  };
}

function applyPenalties(records) {
  return records.map(markPenalty);
}

module.exports = { applyPenalties, markPenalty };
