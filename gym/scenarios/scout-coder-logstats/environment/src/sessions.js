/**
 * Session detection.
 *
 * A "session" is a sequence of requests from the same user where
 * consecutive requests are no more than 30 minutes apart.
 * If the gap between two consecutive requests exceeds 30 minutes,
 * a new session starts.
 *
 * Returns an array of session objects: { user, requests[], startTime, endTime }
 */

const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes

function buildSessions(entries) {
  // Group by user
  const byUser = {};
  for (const entry of entries) {
    if (!byUser[entry.user]) byUser[entry.user] = [];
    byUser[entry.user].push(entry);
  }

  const sessions = [];

  for (const [user, requests] of Object.entries(byUser)) {
    // Sort by timestamp
    requests.sort((a, b) => a.timestamp - b.timestamp);

    let currentSession = {
      user,
      requests: [requests[0]],
      startTime: requests[0].timestamp,
      endTime: requests[0].timestamp,
    };

    for (let i = 1; i < requests.length; i++) {
      const gap = requests[i].timestamp - requests[i - 1].timestamp;

      if (gap > SESSION_GAP_MS) {
        // Start new session
        sessions.push(currentSession);
        currentSession = {
          user,
          requests: [requests[i]],
          startTime: requests[i].timestamp,
          endTime: requests[i].timestamp,
        };
      } else {
        // Continue current session
        currentSession.requests.push(requests[i]);
        currentSession.endTime = requests[i].timestamp;
      }
    }

    sessions.push(currentSession);
  }

  return sessions;
}

module.exports = { buildSessions, SESSION_GAP_MS };
