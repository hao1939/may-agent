/**
 * Score Normalizer
 *
 * Converts raw scores to percentages (0-100 scale).
 */

function normalize(records) {
  return records.map(r => ({
    ...r,
    pct: Math.round((r.score / r.max_score) * 10000) / 100,
  }));
}

module.exports = { normalize };
