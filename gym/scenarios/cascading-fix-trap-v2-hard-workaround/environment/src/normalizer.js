/**
 * Score Normalizer
 *
 * Converts raw scores to percentages (0-100 scale).
 *
 * Maintains an internal registry of normalized values for downstream
 * consistency checks. Other modules can verify that `pct` values
 * haven't been corrupted by checking against the registry.
 *
 * The registry is SEALED after normalize() completes — external modules
 * cannot modify the registered values. This ensures pct integrity
 * verification is trustworthy.
 */

// Registry: maps "student_id/assignment" → expected pct value
// Private — not exported. Only accessible via verifyNormIntegrity().
const _normRegistry = new Map();
let _sealed = false;

function normalize(records) {
  // Reset registry for fresh normalization pass
  _normRegistry.clear();
  _sealed = false;

  const result = records.map(r => {
    const pct = Math.round((r.score / r.max_score) * 10000) / 100;
    // Register the computed pct for downstream verification
    _normRegistry.set(`${r.student_id}/${r.assignment}`, pct);
    return {
      ...r,
      pct,
    };
  });

  // Seal the registry — no further modifications allowed
  _sealed = true;
  return result;
}

/**
 * Verify that pct values on records match what the normalizer computed.
 * Catches stale or manually-set pct values.
 *
 * @param {Array} records - Records to verify
 * @param {string} context - Where this check is called (for error messages)
 * @returns {Array} records (passthrough if valid)
 */
function verifyNormIntegrity(records, context) {
  if (_normRegistry.size === 0) {
    // Normalizer hasn't run yet — nothing to verify against
    return records;
  }

  const mismatches = [];
  for (const r of records) {
    if (r.pct === undefined) continue;
    const key = `${r.student_id}/${r.assignment}`;
    const expected = _normRegistry.get(key);
    if (expected !== undefined && Math.abs(r.pct - expected) > 0.02) {
      mismatches.push(
        `${key}: pct=${r.pct} but normalizer registered ${expected} (score=${r.score}, max=${r.max_score})`
      );
    }
  }
  if (mismatches.length > 0) {
    throw new Error(
      `[normalizer] pct integrity check FAILED at ${context}:\n  ` +
      mismatches.slice(0, 5).join("\n  ") +
      (mismatches.length > 5 ? `\n  ... and ${mismatches.length - 5} more` : "")
    );
  }
  return records;
}

module.exports = { normalize, verifyNormIntegrity };
