import { closeDb, getDb } from "../../src/lib/db/connection.js";

const [root, id] = process.argv.slice(2);
try {
  const db = getDb(root!);
  // This fixture tests concurrent bootstrap, not fail-fast serving writes.
  // Its synthetic INSERT may overlap another opener's schema transaction.
  db.exec("PRAGMA busy_timeout = 5000");
  db.run("INSERT INTO sessions (sessionId, agent, task, startedAt) VALUES (?, 'sample', 'Inspect', 2000)", [id]);
} finally {
  closeDb(root!);
  process.stdin.pause();
}
