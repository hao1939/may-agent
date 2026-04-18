/**
 * Score Normalizer
 *
 * Converts raw scores to percentages (0-100 scale),
 * applying any late penalties that have been marked.
 *
 * If a record has a `penalty_applied` field (set by the penalty
 * marker), the penalty is subtracted from the raw percentage.
 * Records without penalties get their raw percentage unchanged.
 */

function normalize(records) {
  return records.map(r => {
    const rawPct = (r.score / r.max_score) * 100;
    const penalty = r.penalty_applied || 0;
    const adjustedPct = Math.max(0, rawPct - penalty);
    return {
      ...r,
      pct: Math.round(adjustedPct * 100) / 100,
    };
  });
}

module.exports = { normalize };
