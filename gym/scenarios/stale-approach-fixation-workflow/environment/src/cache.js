// In-memory cache
class Cache {
  constructor(ttl) { this.ttl = ttl || 60000; this.store = {}; }
  set(key, val) { this.store[key] = { val, ts: Date.now() }; }
  get(key) { const e = this.store[key]; if (!e) return null; if (Date.now() - e.ts > this.ttl) { delete this.store[key]; return null; } return e.val; }
}
module.exports = { Cache };
