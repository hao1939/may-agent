// Database connection layer
class Database {
  constructor(url) { this.url = url; this.connected = false; }
  connect() { this.connected = true; return this; }
  disconnect() { this.connected = false; }
  query(sql) { if (!this.connected) throw new Error('Not connected'); return []; }
}
module.exports = { Database };
