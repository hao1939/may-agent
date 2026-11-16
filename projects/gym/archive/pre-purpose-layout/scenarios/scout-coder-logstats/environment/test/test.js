/**
 * Log analytics tests.
 *
 * Expected values are hand-computed from data/access.log.
 */
const { analyze } = require("../src/pipeline");
const path = require("path");

const dataFile = path.join(__dirname, "..", "data", "access.log");
const stats = analyze(dataFile);

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}: expected ${expected}, got ${actual}`);
    failed++;
  }
}

function assertClose(actual, expected, label, tolerance = 0.01) {
  if (Math.abs(actual - expected) < tolerance) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}: expected ${expected}, got ${actual}`);
    failed++;
  }
}

console.log("Log Analytics Tests\n");

// --- Sessions ---
// alice: 1 session (09:00-09:06)
// bob: 2 sessions (09:10-09:10:30, 10:00-10:01:15)
// carol: 2 sessions (09:30, 11:15-11:16:30)
// dave: 1 session (10:00)
// eve: 1 session (10:30-10:32:10)
// frank: 1 session (14:00-14:01)
// Total: 8 sessions, 6 users, 22 requests
console.log("Session detection:");
assertEqual(stats.totalSessions, 8, "Total sessions");
assertEqual(stats.uniqueUsers, 6, "Unique users");
assertEqual(stats.totalRequests, 22, "Total requests");

// --- Response time ---
// Sum of response_ms (last column): 312+220+195+280+175+165+145+190+210+115+250+175+148+285+155+185+165+130+270+185+195+140 = 4290
// Avg = 4290 / 22 = 195.0
console.log("\nResponse time:");
assertClose(stats.avgResponseTime, 195.0, "Average response time (ms)");
// P95: sorted response times, index = ceil(22*0.95)-1 = 20
// Sorted: 115,130,140,145,148,155,155,165,165,175,175,185,185,190,195,195,210,220,250,270,280,312
// Index 20 = 280
assertEqual(stats.p95ResponseTime, 285, "P95 response time (ms)");

// --- Error rate ---
// Only 1 request with status >= 500 (carol's POST /cart 500)
// Error rate = 1/22 = 0.0455
console.log("\nError rate:");
assertClose(stats.errorRate, 0.0455, "Error rate (server errors only)");

// --- Path analysis ---
// /home appears 7 times
console.log("\nPath analysis:");
assertEqual(stats.topPaths[0].path, "/home", "Most visited path is /home");
assertEqual(stats.topPaths[0].count, 7, "/home visit count");

// --- Bandwidth ---
// Sum of bytes (7th column): 245+187+156+342+198+203+178+165+225+132+289+195+167+312+135+210+172+148+295+155+230+185 = 4524
console.log("\nBandwidth:");
assertEqual(stats.totalBandwidth, 4524, "Total bandwidth in bytes");

// --- Session duration ---
// alice: 360s, bob-1: 30s, bob-2: 75s, carol-1: 0, carol-2: 90s, dave: 0, eve: 130s, frank: 60s
// Avg = (360+30+75+0+90+0+130+60)/8 = 745/8 = 93.125
console.log("\nSession duration:");
assertClose(stats.avgSessionDuration, 93.13, "Avg session duration (seconds)");

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} tests\n`);
if (failed > 0) process.exit(1);
