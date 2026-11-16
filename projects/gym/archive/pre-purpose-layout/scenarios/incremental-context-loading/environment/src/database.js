/**
 * Database Module — PostgreSQL connection pool and query helpers
 *
 * Provides:
 * - Connection pool management
 * - Query helper functions for metric_buckets table
 * - Migration runner
 * - Connection health checks
 */

const { Pool } = require('pg');

// ── Connection Pool ──────────────────────────────────────────────────

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  min: parseInt(process.env.DB_POOL_MIN || '2'),
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT || '5000'),
};

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

pool.on('connect', () => {
  console.debug('New database connection established');
});

// ── Query Helpers ────────────────────────────────────────────────────

/**
 * Get the latest value for a metric at a given granularity.
 * @param {string} metricName
 * @param {string} granularity - One of: 1m, 5m, 1h, 1d
 * @returns {Promise<{value: number, timestamp: Date, count: number}|null>}
 */
async function getLatestMetric(metricName, granularity = '1m') {
  const result = await pool.query(
    `SELECT value, count, bucket_start as timestamp
     FROM metric_buckets
     WHERE metric_name = $1 AND granularity = $2
     ORDER BY bucket_start DESC
     LIMIT 1`,
    [metricName, granularity]
  );

  if (result.rows.length === 0) return null;

  return {
    value: parseFloat(result.rows[0].value),
    timestamp: result.rows[0].timestamp,
    count: result.rows[0].count,
  };
}

/**
 * Get metric history within a time range.
 * @param {string} metricName
 * @param {string} granularity
 * @param {Date|string} start
 * @param {Date|string} end
 * @returns {Promise<Array<{value: number, timestamp: Date, count: number}>>}
 */
async function getMetricHistory(metricName, granularity, start, end) {
  const result = await pool.query(
    `SELECT bucket_start as timestamp, value, count
     FROM metric_buckets
     WHERE metric_name = $1 AND granularity = $2
       AND bucket_start >= $3 AND bucket_end <= $4
     ORDER BY bucket_start ASC`,
    [metricName, granularity, start, end]
  );

  return result.rows.map(row => ({
    value: parseFloat(row.value),
    timestamp: row.timestamp,
    count: row.count,
  }));
}

/**
 * Insert or update a metric bucket.
 * Uses UPSERT (ON CONFLICT) to handle concurrent writes.
 * @param {string} metricName
 * @param {Date|string} bucketStart
 * @param {Date|string} bucketEnd
 * @param {string} granularity
 * @param {number} value
 * @param {number} count
 */
async function upsertMetricBucket(metricName, bucketStart, bucketEnd, granularity, value, count) {
  await pool.query(
    `INSERT INTO metric_buckets (metric_name, bucket_start, bucket_end, granularity, value, count)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (metric_name, bucket_start, granularity)
     DO UPDATE SET value = EXCLUDED.value, count = metric_buckets.count + EXCLUDED.count`,
    [metricName, bucketStart, bucketEnd, granularity, value, count]
  );
}

/**
 * Insert a raw event into the events table.
 * @param {string} eventType
 * @param {object} payload
 * @param {Date|string} timestamp
 * @returns {Promise<string>} The event ID
 */
async function insertEvent(eventType, payload, timestamp) {
  const result = await pool.query(
    `INSERT INTO events (event_type, payload, timestamp)
     VALUES ($1, $2::jsonb, $3)
     RETURNING id`,
    [eventType, JSON.stringify(payload), timestamp]
  );
  return result.rows[0].id;
}

/**
 * Mark an event as processed.
 * @param {string} eventId
 */
async function markEventProcessed(eventId) {
  await pool.query(
    `UPDATE events SET processed_at = NOW() WHERE id = $1`,
    [eventId]
  );
}

/**
 * Get unprocessed events (for worker recovery).
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function getUnprocessedEvents(limit = 100) {
  const result = await pool.query(
    `SELECT id, event_type, payload, timestamp
     FROM events
     WHERE processed_at IS NULL
     ORDER BY timestamp ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Delete old processed events (retention cleanup).
 * @param {number} daysToKeep
 * @returns {Promise<number>} Number of deleted rows
 */
async function cleanupOldEvents(daysToKeep = 30) {
  const result = await pool.query(
    `DELETE FROM events
     WHERE processed_at IS NOT NULL
       AND timestamp < NOW() - INTERVAL '1 day' * $1`,
    [daysToKeep]
  );
  return result.rowCount;
}

/**
 * Get aggregate statistics for monitoring.
 * @returns {Promise<{total_events: number, unprocessed: number, oldest_unprocessed: Date|null}>}
 */
async function getStats() {
  const result = await pool.query(`
    SELECT
      COUNT(*) as total_events,
      COUNT(*) FILTER (WHERE processed_at IS NULL) as unprocessed,
      MIN(timestamp) FILTER (WHERE processed_at IS NULL) as oldest_unprocessed
    FROM events
  `);

  return {
    total_events: parseInt(result.rows[0].total_events),
    unprocessed: parseInt(result.rows[0].unprocessed),
    oldest_unprocessed: result.rows[0].oldest_unprocessed,
  };
}

// ── Migration Runner ─────────────────────────────────────────────────

const MIGRATIONS = [
  {
    version: 1,
    name: 'create_events_table',
    sql: `
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events (timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_unprocessed ON events (processed_at) WHERE processed_at IS NULL;
    `,
  },
  {
    version: 2,
    name: 'create_metric_buckets_table',
    sql: `
      CREATE TABLE IF NOT EXISTS metric_buckets (
        id SERIAL PRIMARY KEY,
        metric_name VARCHAR(200) NOT NULL,
        bucket_start TIMESTAMPTZ NOT NULL,
        bucket_end TIMESTAMPTZ NOT NULL,
        granularity VARCHAR(20) NOT NULL,
        value NUMERIC NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        UNIQUE (metric_name, bucket_start, granularity)
      );
      CREATE INDEX IF NOT EXISTS idx_metric_buckets_name ON metric_buckets (metric_name);
      CREATE INDEX IF NOT EXISTS idx_metric_buckets_range ON metric_buckets (bucket_start, bucket_end);
    `,
  },
  {
    version: 3,
    name: 'create_cache_metadata_table',
    sql: `
      CREATE TABLE IF NOT EXISTS cache_metadata (
        cache_key VARCHAR(500) PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        hit_count INTEGER NOT NULL DEFAULT 0
      );
    `,
  },
];

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const applied = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
  const appliedVersions = new Set(applied.rows.map(r => r.version));

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;
    console.log(`Running migration ${migration.version}: ${migration.name}`);
    await pool.query(migration.sql);
    await pool.query(
      'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
      [migration.version, migration.name]
    );
  }
}

// ── Health Check ─────────────────────────────────────────────────────

async function healthCheck() {
  try {
    await pool.query('SELECT 1');
    return { healthy: true };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
}

// ── Exports ──────────────────────────────────────────────────────────

module.exports = {
  pool,
  getLatestMetric,
  getMetricHistory,
  upsertMetricBucket,
  insertEvent,
  markEventProcessed,
  getUnprocessedEvents,
  cleanupOldEvents,
  getStats,
  runMigrations,
  healthCheck,
};
