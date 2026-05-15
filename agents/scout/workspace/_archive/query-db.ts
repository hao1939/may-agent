import { Database } from "bun:sqlite";
const db = new Database(".state/may.db", { readonly: true });
const sql = process.argv[2];
if (sql) {
  console.log(db.query(sql).all());
} else {
  console.log(db.query("SELECT name FROM sqlite_master WHERE type='table';").all());
}
