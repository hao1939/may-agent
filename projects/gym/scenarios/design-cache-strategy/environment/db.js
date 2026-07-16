/**
 * Simulated database — reads user profiles from a JSON file.
 * Tracks call count for performance measurement.
 */

const fs = require('fs');
const path = require('path');

let callCount = 0;

const usersData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'users.json'), 'utf-8')
);

// Index by ID for O(1) lookup
const usersById = {};
for (const user of usersData) {
  usersById[user.id] = user;
}

function loadUser(userId) {
  callCount++;
  // Simulate I/O cost with a small delay marker (no actual delay — tracked by count)
  return usersById[userId] || null;
}

function getCallCount() {
  return callCount;
}

function resetCallCount() {
  callCount = 0;
}

module.exports = { loadUser, getCallCount, resetCallCount };
