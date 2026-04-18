const { DatabaseSync } = require('node:sqlite');

try {
  console.log("Opening test/gym/stats.db...");
  const db = new DatabaseSync('test/gym/stats.db');
  const stmt = db.prepare("PRAGMA table_info(results)");
  const columns = stmt.all();
  console.log("Columns in 'results' table:");
  columns.forEach(col => console.log(`- ${col.name} (${col.type})`));
} catch (error) {
  console.error("Error verifying schema:", error.message);
}
