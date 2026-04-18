
import { Database } from "bun:sqlite";
import { join } from "node:path";

const dbPath = join(process.cwd(), "test", "gym", "stats.db");
console.log(`Checking DB at: ${dbPath}`);

try {
  const db = new Database(dbPath, { readonly: true });
  const columns = db.query("PRAGMA table_info(checks);").all();
  
  const hasCategory = columns.some((c: any) => c.name === "category");
  const hasCode = columns.some((c: any) => c.name === "code");
  
  console.log(JSON.stringify({ 
    table: "checks", 
    hasCategory, 
    hasCode,
    columns: columns.map((c: any) => c.name) 
  }, null, 2));
  
  db.close();
} catch (e) {
  console.error("Error opening DB:", e.message);
}
