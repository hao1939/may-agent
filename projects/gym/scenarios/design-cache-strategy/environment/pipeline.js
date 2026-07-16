/**
 * Data Pipeline — processes analytics events
 *
 * Currently re-fetches user profiles from the database on every event.
 * This is inefficient — caching would help significantly.
 */

const { loadUser } = require('./db');

function processEvent(event) {
  // Look up the user for every single event (wasteful!)
  const user = loadUser(event.userId);
  if (!user) {
    return { status: 'skipped', reason: 'unknown user', eventId: event.id };
  }

  return {
    status: 'processed',
    eventId: event.id,
    userId: user.id,
    userName: user.name,
    tier: user.tier,
    eventType: event.type,
    timestamp: event.timestamp
  };
}

function runPipeline(events) {
  const results = [];
  for (const event of events) {
    results.push(processEvent(event));
  }
  return results;
}

module.exports = { processEvent, runPipeline };
