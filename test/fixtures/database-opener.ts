import { closeDb, getDb } from "../../src/lib/db/connection.js";

const [root, id] = process.argv.slice(2);
try {
  const db = getDb(root!);
  db.run("INSERT INTO sessions (sessionId, agent, task, startedAt) VALUES (?, 'sample', 'Inspect', 2000)", [id]);
} finally {
  closeDb(root!);
  process.stdin.pause();
}
