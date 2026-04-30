/**
 * Session Analyzer — identifies patterns in iteration logs and returns actionable suggestions.
 */

export interface IterationRecord {
  id: string;
  deliverableProduced: boolean;
  firstAttempt: boolean;
  durationMs: number;
  targetPath?: string;
  workflow?: string;
  timestamp?: number;
  error?: string;
}

export interface AnalysisResult {
  slowest: IterationRecord[];
  patterns: string[];
  suggestions: string[];
}

export function analyzeIterations(entries: IterationRecord[]): AnalysisResult {
  if (!entries || entries.length === 0) {
    return { slowest: [], patterns: [], suggestions: ['No iteration data available. Run some iterations first.'] };
  }

  const avgDuration = entries.reduce((sum, e) => sum + e.durationMs, 0) / entries.length;
  const threshold = avgDuration * 2;

  // Find slow outliers
  const slowest = entries
    .filter(e => e.durationMs > threshold)
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 5);

  // Identify patterns
  const patterns: string[] = [];
  const suggestions: string[] = [];

  const failedEntries = entries.filter(e => !e.deliverableProduced);
  const retryEntries = entries.filter(e => !e.firstAttempt);
  const successRate = entries.filter(e => e.deliverableProduced).length / entries.length;

  if (failedEntries.length > 0) {
    const failRate = (failedEntries.length / entries.length * 100).toFixed(1);
    patterns.push(`${failRate}% of iterations failed to produce a deliverable (${failedEntries.length}/${entries.length})`);
  }

  if (retryEntries.length > 0) {
    const retryRate = (retryEntries.length / entries.length * 100).toFixed(1);
    patterns.push(`${retryRate}% of iterations required retries (${retryEntries.length}/${entries.length})`);
  }

  if (slowest.length > 0) {
    patterns.push(`${slowest.length} iterations exceeded 2x average duration (>${Math.round(threshold)}ms)`);
  }

  // Group failures by error if available
  const errorGroups: Record<string, number> = {};
  failedEntries.forEach(e => {
    const key = e.error || 'unknown';
    errorGroups[key] = (errorGroups[key] || 0) + 1;
  });

  const topErrors = Object.entries(errorGroups)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  if (topErrors.length > 0 && topErrors[0][0] !== 'unknown') {
    patterns.push(`Top failure reason: "${topErrors[0][0]}" (${topErrors[0][1]} occurrences)`);
  }

  // Generate suggestions
  if (successRate < 0.8) {
    suggestions.push('Deliverable rate below 80%. Consider adding explicit targetPath to task templates.');
  }

  if (retryEntries.length / entries.length > 0.2) {
    suggestions.push('High retry rate (>20%). Review task clarity and add write-first constraints.');
  }

  if (slowest.length > entries.length * 0.1) {
    suggestions.push('Many slow iterations. Check for unnecessary reads/scans before writes.');
  }

  if (successRate >= 0.95 && retryEntries.length === 0) {
    suggestions.push('Excellent performance. Consider increasing task complexity or parallelism.');
  }

  if (suggestions.length === 0) {
    suggestions.push('Performance is within normal ranges. Continue current approach.');
  }

  return { slowest, patterns, suggestions };
}
