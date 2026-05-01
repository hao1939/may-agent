import { Database } from "bun:sqlite";
const db = new Database(".state/may.db", { readonly: true });
console.log(db.query("SELECT * FROM metrics WHERE owner = 'scout'").all());
