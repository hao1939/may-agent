import { Database } from "bun:sqlite";

try {
  const db = new Database("test/gym/stats.db");
  const query = db.prepare("PRAGMA table_info(results)");
  const columns = query.all();
  
  console.log("Columns in 'results' table:");
  const columnNames = columns.map(c => c.name);
  console.log(columnNames.join(", "));
  
  const hasCategory = columnNames.includes("category");
  const hasCode = columnNames.includes("code");
  
  if (hasCategory && hasCode) {
    console.log("SUCCESS: Schema verification passed. 'category' and 'code' columns exist.");
  } else {
    console.log(`FAILURE: Schema verification failed. Missing columns. Has category: ${hasCategory}, Has code: ${hasCode}`);
  }
} catch (error) {
  console.error("ERROR opening database:", error);
}
