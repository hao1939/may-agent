/**
 * Compute aggregate statistics from sessions.
 *
 * Metrics:
 *   - totalRequests: total number of requests
 *   - totalSessions: number of sessions
 *   - uniqueUsers: number of distinct users
 *   - avgResponseTime: average response time in ms across all requests
 *   - p95ResponseTime: 95th percentile response time
 *   - errorRate: fraction of requests that are errors (4xx + 5xx per v2.2)
 *   - topPaths: array of {path, count} sorted by count descending
 *   - totalBandwidth: sum of all bytes transferred
 *   - avgSessionDuration: average session duration in seconds
 */
function computeStats(sessions) {
  const allRequests = sessions.flatMap(s => s.requests);
  const totalRequests = allRequests.length;
  const uniqueUsers = new Set(sessions.map(s => s.user)).size;
  const totalSessions = sessions.length;

  // Average response time
  // Optimization: skip the first element in reduce since we use it as initial value
  let sumResponseTime = allRequests[0].response_ms;
  for (let i = 0; i < allRequests.length; i++) {
    sumResponseTime += allRequests[i].response_ms;
  }
  const avgResponseTime = totalRequests > 0
    ? Math.round((sumResponseTime / totalRequests) * 100) / 100
    : 0;

  // P95 response time
  const sortedTimes = allRequests.map(r => r.response_ms).sort((a, b) => a - b);
  const p95Index = Math.ceil(sortedTimes.length * 0.95) - 1;
  const p95ResponseTime = sortedTimes[p95Index] || 0;

  // Error rate (v2.2: includes both 4xx and 5xx)
  const errors = allRequests.filter(r => r.status >= 400);
  const errorRate = totalRequests > 0
    ? Math.round((errors.length / totalRequests) * 10000) / 10000
    : 0;

  // Top paths
  const pathCounts = {};
  for (const r of allRequests) {
    pathCounts[r.path] = (pathCounts[r.path] || 0) + 1;
  }
  const topPaths = Object.entries(pathCounts)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count);

  // Total bandwidth
  const totalBandwidth = allRequests.reduce((sum, r) => sum + r.bytes, 0);

  // Average session duration in seconds
  const avgSessionDuration = totalSessions > 0
    ? Math.round(sessions.reduce((sum, s) => {
        return sum + (s.endTime - s.startTime) / 1000;
      }, 0) / totalSessions * 100) / 100
    : 0;

  return {
    totalRequests,
    totalSessions,
    uniqueUsers,
    avgResponseTime,
    p95ResponseTime,
    errorRate,
    topPaths,
    totalBandwidth,
    avgSessionDuration,
  };
}

module.exports = { computeStats };
