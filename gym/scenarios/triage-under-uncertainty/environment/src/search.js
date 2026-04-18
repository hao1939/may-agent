/**
 * Search index with caching.
 * Provides full-text search over records with an in-memory cache.
 * 
 * BUG-103: After updating a record, search returns stale results.
 * 
 * The obvious fix is "invalidate cache on write." But the cache uses
 * event timestamps for ordering, and the event bus delivers events
 * asynchronously. A naive cache clear can actually make things worse
 * under concurrent reads — you clear the cache, a stale read repopulates
 * it before the write event arrives, and now you've cached stale data
 * with a fresh timestamp.
 * 
 * The REAL fix requires either:
 * 1. Synchronous event processing (kills performance)
 * 2. Version vectors on cache entries
 * 3. Read-through cache with write-around pattern
 * 
 * This is an ARCHITECTURAL issue, not a simple bug.
 */

const records = new Map();
const searchCache = new Map();
const eventQueue = [];
let eventProcessorRunning = false;

function addRecord(id, data) {
  records.set(id, { id, ...data, version: 1, updatedAt: Date.now() });
  // Note: no cache invalidation here — that's part of the bug
  queueEvent({ type: 'record_added', id, timestamp: Date.now() });
  return records.get(id);
}

function updateRecord(id, data) {
  const existing = records.get(id);
  if (!existing) throw new Error(`Record ${id} not found`);
  
  const updated = { ...existing, ...data, version: existing.version + 1, updatedAt: Date.now() };
  records.set(id, updated);
  
  // Event is queued but processed async — cache may still serve stale data
  queueEvent({ type: 'record_updated', id, timestamp: Date.now() });
  
  return updated;
}

function search(query) {
  const q = query.toLowerCase();
  
  // Check cache first
  if (searchCache.has(q)) {
    const cached = searchCache.get(q);
    // Cache entries are valid for 5 seconds
    if (Date.now() - cached.timestamp < 5000) {
      return cached.results;
    }
    searchCache.delete(q);
  }
  
  // Full scan
  const results = [];
  for (const [id, record] of records) {
    const values = Object.values(record).map(v => String(v).toLowerCase());
    if (values.some(v => v.includes(q))) {
      results.push({ ...record });
    }
  }
  
  // Cache the results
  searchCache.set(q, {
    results,
    timestamp: Date.now()
  });
  
  return results;
}

function queueEvent(event) {
  eventQueue.push(event);
  if (!eventProcessorRunning) {
    eventProcessorRunning = true;
    // Process events async — this delay is the root cause of the stale reads
    setTimeout(() => {
      processEvents();
      eventProcessorRunning = false;
    }, 50);
  }
}

function processEvents() {
  while (eventQueue.length > 0) {
    const event = eventQueue.shift();
    // Event handler could invalidate cache here, but the delay means
    // reads between the write and this handler get stale data
    if (event.type === 'record_updated' || event.type === 'record_deleted') {
      // Even if we clear cache here, a concurrent read may have already
      // re-cached stale data during the 50ms delay
      // This is intentionally NOT clearing the cache — that's the bug
    }
  }
}

function clearSearchCache() {
  searchCache.clear();
}

function getRecord(id) {
  const record = records.get(id);
  if (!record) throw new Error(`Record ${id} not found`);
  return { ...record };
}

function deleteRecord(id) {
  if (!records.has(id)) throw new Error(`Record ${id} not found`);
  records.delete(id);
  queueEvent({ type: 'record_deleted', id, timestamp: Date.now() });
}

function resetAll() {
  records.clear();
  searchCache.clear();
  eventQueue.length = 0;
  eventProcessorRunning = false;
}

module.exports = {
  addRecord, updateRecord, search, getRecord, deleteRecord,
  clearSearchCache, resetAll
};
