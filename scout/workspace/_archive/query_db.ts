import { Database } from "bun:sqlite";
const db = new Database(".state/may.db");
const results = db.query("SELECT * FROM metrics WHERE owner='scout'").all();
console.log(JSON.stringify(results, null, 2));
