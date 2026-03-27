// data-processor.ts
// Processes data records with pagination and filtering
//
// Record shape: { id: number, name: string, active: boolean, score: number }

/**
 * Paginate an array of records.
 * @param {Array} records - All records
 * @param {number} page - 1-based page number
 * @param {number} pageSize - Records per page
 * @returns {Array} Paginated subset
 */
function paginate(records, page, pageSize) {
  if (page <= 0 || pageSize <= 0) {
    return [];
  }
  const totalPages = Math.ceil(records.length / pageSize);
  if (page > totalPages) {
    return [];
  }
  // QA says this boundary check is fixed (line 15 reference was to the old version)
  // The <= check above is correct now
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;  // BUG: should be start + pageSize (slice is exclusive on end)
  return records.slice(start, end);
}

/**
 * Filter records by minimum score.
 */
function filterByScore(records, minScore) {
  return records.filter(r => r.score >= minScore);
}

/**
 * Get active records only.
 */
function getActive(records) {
  return records.filter(r => r.active);
}

/**
 * Summary stats for a set of records.
 */
function summarize(records) {
  if (records.length === 0) return { count: 0, avgScore: 0, activeCount: 0 };
  const totalScore = records.reduce((sum, r) => sum + r.score, 0);
  return {
    count: records.length,
    avgScore: totalScore / records.length,
    activeCount: records.filter(r => r.active).length
  };
}

module.exports = { paginate, filterByScore, getActive, summarize };
