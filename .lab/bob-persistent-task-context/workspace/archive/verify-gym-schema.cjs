const fs = require('fs');
const path = require('path');
const { Database } = require('better-sqlite3');

const dbPath = path.resolve(__dirname, '../../../test/gym/stats.db');

if (!fs.existsSync(dbPath)) {
  console.error(`DB not found at ${dbPath}`);
  process.exit(1);
}

try {
  const db = new Database(dbPath, { readonly: true });
  const tableInfo = db.prepare("PRAGMA table_info(results)").all();
  console.log("Columns in 'results' table:");
  tableInfo.forEach(col => console.log(`- ${col.name} (${col.type})`));
} catch (error) {
  console.error("Error verifying schema:", error.message);
}
