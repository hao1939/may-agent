
import { Database } from "bun:sqlite";
const db = new Database("test/gym/stats.db");
const schema = db.query("PRAGMA table_info(checks)").all();
console.log(JSON.stringify(schema));
db.close();
