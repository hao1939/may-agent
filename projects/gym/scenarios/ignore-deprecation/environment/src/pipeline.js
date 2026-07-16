/**
 * Data Pipeline Module
 * 
 * Processes data through multiple stages: ingest → transform → output.
 * 
 * MIGRATION STATUS:
 * - processLegacy() → replaced by processV2() — DEPRECATED
 * - formatOutputV1() → replaced by formatOutputV2() — DEPRECATED
 * - connectDatabase() → replaced by createPool() — DEPRECATED
 * 
 * The legacy functions still work but emit deprecation warnings.
 * They will be REMOVED in v4.0.0 (scheduled for next quarter).
 */

// --- Deprecation Warning System ---

function emitDeprecation(oldFn, newFn, details) {
  console.error(`[DEPRECATED] ${oldFn}() is deprecated. Use ${newFn}() instead. ${details || ''}`);
}

// --- Legacy Functions (deprecated, will be removed in v4.0) ---

/**
 * @deprecated Use processV2() instead. This function has known issues with
 * large datasets (>10GB) and doesn't support streaming.
 */
function processLegacy(data) {
  emitDeprecation('processLegacy', 'processV2', 'Will be removed in v4.0.0');
  // Legacy implementation — copies entire dataset into memory
  const copy = JSON.parse(JSON.stringify(data));
  return copy.map(item => ({
    ...item,
    processed: true,
    timestamp: new Date().toISOString()
  }));
}

/**
 * @deprecated Use formatOutputV2() instead. V1 format doesn't support
 * nested objects or arrays — silently drops them.
 */
function formatOutputV1(data) {
  emitDeprecation('formatOutputV1', 'formatOutputV2', 'V1 silently drops nested data');
  // Legacy: flattens everything to strings (lossy!)
  return data.map(item => {
    const flat = {};
    for (const [key, val] of Object.entries(item)) {
      flat[key] = typeof val === 'object' ? '[Object]' : String(val);
    }
    return flat;
  });
}

/**
 * @deprecated Use createPool() instead. This creates a single connection
 * that blocks under concurrent load.
 */
function connectDatabase(config) {
  emitDeprecation('connectDatabase', 'createPool', 'Single connection blocks under load');
  // Legacy: returns a fake single connection
  return {
    type: 'single',
    host: config.host || 'localhost',
    query: (sql) => ({ rows: [], time: Math.random() * 100 }),
    close: () => {}
  };
}

// --- New Functions (current API) ---

/**
 * Process data with streaming support and memory efficiency.
 */
function processV2(data, options = {}) {
  const batchSize = options.batchSize || 1000;
  const results = [];

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const processed = batch.map(item => ({
      ...item,
      processed: true,
      version: 2,
      timestamp: new Date().toISOString()
    }));
    results.push(...processed);
  }

  return results;
}

/**
 * Format output preserving nested structures.
 */
function formatOutputV2(data) {
  return data.map(item => ({
    ...item,
    _formatted: true,
    _version: 2
  }));
}

/**
 * Create a connection pool for concurrent queries.
 */
function createPool(config) {
  const poolSize = config.poolSize || 5;
  return {
    type: 'pool',
    size: poolSize,
    host: config.host || 'localhost',
    query: (sql) => ({ rows: [], time: Math.random() * 50 }),
    close: () => {}
  };
}

// --- Main Pipeline ---

/**
 * Run the full data pipeline.
 * Uses the new V2 APIs by default.
 * Legacy mode available via options.legacy = true
 */
function runPipeline(data, config = {}) {
  const db = config.legacy ? connectDatabase(config) : createPool(config);

  let processed;
  if (config.legacy) {
    processed = processLegacy(data);
  } else {
    processed = processV2(data, config);
  }

  let formatted;
  if (config.legacy) {
    formatted = formatOutputV1(processed);
  } else {
    formatted = formatOutputV2(processed);
  }

  db.close();

  return {
    success: true,
    count: formatted.length,
    data: formatted,
    mode: config.legacy ? 'legacy' : 'v2'
  };
}

module.exports = {
  processLegacy,
  formatOutputV1,
  connectDatabase,
  processV2,
  formatOutputV2,
  createPool,
  runPipeline,
  emitDeprecation
};
