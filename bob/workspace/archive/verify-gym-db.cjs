const { Database } = require('node-sqlite3-wasm');

try {
  const db = new Database('test/gym/stats.db');
  const tableInfo = db.prepare("PRAGMA table_info(results)").all();
  console.log("Columns in 'results' table:");
  tableInfo.forEach(col => console.log(`- ${col.name} (${col.type})`));
} catch (error) {
  console.error("Error verifying schema:", error.message);
}
