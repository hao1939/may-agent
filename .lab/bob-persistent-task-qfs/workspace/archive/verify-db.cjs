
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve('test/gym/stats.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error("Error opening DB:", err.message);
    process.exit(1);
  }
});

db.all("PRAGMA table_info(checks)", (err, rows) => {
  if (err) {
    console.error("Error reading schema:", err.message);
    process.exit(1);
  }
  const columns = rows.map(r => r.name);
  console.log("Columns in 'checks' table:", columns.join(", "));
  
  const hasCategory = columns.includes('category');
  const hasCode = columns.includes('code');
  
  if (hasCategory && hasCode) {
    console.log("VERIFICATION_SUCCESS: category and code columns present.");
  } else {
    console.log("VERIFICATION_FAILURE: Missing columns. Category: " + hasCategory + ", Code: " + hasCode);
  }
  db.close();
});
