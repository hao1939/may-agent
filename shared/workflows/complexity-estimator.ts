/**
 * Task Complexity Estimator
 * Analyzes task descriptions to estimate complexity and recommend timeouts.
 */

export type ComplexityScore = 1 | 2 | 3 | 4 | 5;

export interface ComplexityEstimate {
  score: ComplexityScore;
  timeoutMs: number;
  description: string;
}

const TIMEOUT_MAP: Record<ComplexityScore, number> = {
  1: 60_000,      // 1 min - trivial tasks
  2: 120_000,     // 2 min - simple tasks
  3: 300_000,     // 5 min - moderate tasks
  4: 600_000,     // 10 min - complex tasks
  5: 900_000,     // 15 min - very complex tasks
};

const DESCRIPTION_MAP: Record<ComplexityScore, string> = {
  1: 'Trivial — single file read/write, no logic',
  2: 'Simple — documentation, small edits, single module',
  3: 'Moderate — new module with tests, multi-file reads',
  4: 'Complex — multi-file implementation with integration',
  5: 'Very complex — cross-system changes, many dependencies',
};

export function estimateComplexity(task: string): ComplexityEstimate {
  try {
  let score = 2; // baseline: simple task
  const lower = task.toLowerCase();

  // File count signals
  const fileRefs = (lower.match(/\.[a-z]{2,4}\b/g) || []).length;
  if (fileRefs >= 5) score += 2;
  else if (fileRefs >= 3) score += 1.5;
  else if (fileRefs >= 2) score += 1;
  else if (fileRefs === 1) score += 0.5;

  // Implementation signals (heavier than docs)
  if (/\b(implement|create module|build|architect)\b/.test(lower)) score += 1;
  if (/\b(integrate|wire|connect|hook into)\b/.test(lower)) score += 1;

  // Test target signals
  const testMatch = lower.match(/(\d+)\+?\s*test/);
  if (testMatch) {
    const count = parseInt(testMatch[1]);
    if (count >= 20) score += 1.5;
    else if (count >= 15) score += 1;
    else if (count >= 5) score += 0.5;
  }

  // Multi-module signals
  if (/\b(multiple files|several modules|cross-system|end-to-end)\b/.test(lower)) score += 1;

  // "with tests" or "write tests" adds moderate complexity
  if (/\b(with tests|write tests|integration tests)\b/.test(lower)) score += 0.5;

  // Simplicity discounts (only apply the strongest one, don't stack)
  const isDoc = /\b(document|report|summary|audit|plan)\b/.test(lower) && !/implement|integrate/.test(lower);
  const isReadOnly = /\b(read|list|check|verify|count)\b/.test(lower) && !/implement|create|integrate|write/.test(lower);

  if (isReadOnly) score -= 1;
  else if (isDoc) score -= 0.5;

  // Clamp to valid range
  const clamped = Math.max(1, Math.min(5, Math.round(score))) as ComplexityScore;

  return {
    score: clamped,
    timeoutMs: TIMEOUT_MAP[clamped],
    description: DESCRIPTION_MAP[clamped],
  };
  } catch (error) {
    // Graceful degradation: return medium complexity on parse errors
    return { score: 3 as ComplexityScore, timeoutMs: TIMEOUT_MAP[3], description: 'Fallback estimate due to analysis error' };
  }
}
