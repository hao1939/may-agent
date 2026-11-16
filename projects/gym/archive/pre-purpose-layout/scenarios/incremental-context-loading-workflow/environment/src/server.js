/**
 * Analytics Dashboard Service — HTTP Server
 *
 * Express-based HTTP server that handles:
 * - Event ingestion (POST /api/events)
 * - Metric queries (GET /api/metrics/:name)
 * - Dashboard summary (GET /api/dashboard/summary)
 * - Health checks (GET /health, GET /health/ready)
 */

const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const jwt = require('jsonwebtoken');
const { CacheManager } = require('./cache');
const { validateEvent } = require('./validators/event-schema');

const app = express();
app.use(express.json({ limit: '1mb' }));

// ── Configuration ────────────────────────────────────────────────────

const config = {
  port: parseInt(process.env.PORT || '3000'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  cacheTtl: parseInt(process.env.CACHE_TTL || '60'),
  cacheMaxEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '10000'),
};

// ── External connections ─────────────────────────────────────────────

const redis = new Redis(config.redisUrl);
const pool = new Pool({ connectionString: config.databaseUrl });
const cache = new CacheManager(redis, {
  defaultTtl: config.cacheTtl,
  maxEntries: config.cacheMaxEntries,
});

// ── Middleware ────────────────────────────────────────────────────────

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' }
    });
  }

  try {
    const token = authHeader.slice(7);
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch (err) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' }
    });
  }
}

function rateLimit(req, res, next) {
  const userId = req.user?.id || 'anonymous';
  const key = `ratelimit:${userId}`;

  redis.multi()
    .incr(key)
    .expire(key, 60)
    .exec()
    .then(results => {
      const count = results[0][1];
      res.set('X-RateLimit-Limit', '100');
      res.set('X-RateLimit-Remaining', Math.max(0, 100 - count).toString());

      if (count > 100) {
        return res.status(429).json({
          error: { code: 'RATE_LIMITED', message: 'Too many requests' }
        });
      }
      next();
    })
    .catch(err => {
      console.error('Rate limit error:', err);
      next(); // fail open
    });
}

// ── Health endpoints ─────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/health/ready', async (req, res) => {
  try {
    await redis.ping();
    await pool.query('SELECT 1');
    res.json({
      status: 'ready',
      checks: { redis: 'connected', postgres: 'connected' }
    });
  } catch (err) {
    res.status(503).json({
      status: 'not ready',
      checks: { error: err.message }
    });
  }
});

// ── API endpoints ────────────────────────────────────────────────────

app.get('/api/metrics/:name', authenticate, rateLimit, async (req, res) => {
  const { name } = req.params;
  const granularity = req.query.granularity || '1m';

  try {
    // Check cache first
    const cacheKey = `metric:${name}:${granularity}:latest`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Query database
    const result = await pool.query(
      `SELECT metric_name, value, count, bucket_start as timestamp
       FROM metric_buckets
       WHERE metric_name = $1 AND granularity = $2
       ORDER BY bucket_start DESC LIMIT 1`,
      [name, granularity]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: `Metric '${name}' not found` }
      });
    }

    const data = {
      metric: result.rows[0].metric_name,
      value: parseFloat(result.rows[0].value),
      timestamp: result.rows[0].timestamp,
      granularity,
    };

    // Cache the result
    await cache.set(cacheKey, data, config.cacheTtl);
    res.json(data);
  } catch (err) {
    console.error('Metrics query error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve metric' }
    });
  }
});

app.get('/api/metrics/:name/history', authenticate, rateLimit, async (req, res) => {
  const { name } = req.params;
  const { start, end, granularity } = req.query;

  if (!start || !end) {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'start and end are required' }
    });
  }

  try {
    const gran = granularity || autoGranularity(start, end);
    const cacheKey = `metric:${name}:${gran}:${start}:${end}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    const result = await pool.query(
      `SELECT bucket_start as timestamp, value, count
       FROM metric_buckets
       WHERE metric_name = $1 AND granularity = $2
         AND bucket_start >= $3 AND bucket_end <= $4
       ORDER BY bucket_start ASC`,
      [name, gran, start, end]
    );

    const data = {
      metric: name,
      granularity: gran,
      data: result.rows.map(r => ({
        timestamp: r.timestamp,
        value: parseFloat(r.value),
        count: r.count,
      })),
    };

    const ttl = gran === '1d' ? 300 : gran === '1h' ? 120 : config.cacheTtl;
    await cache.set(cacheKey, data, ttl);
    res.json(data);
  } catch (err) {
    console.error('History query error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve history' }
    });
  }
});

app.get('/api/dashboard/summary', authenticate, rateLimit, async (req, res) => {
  try {
    const cacheKey = 'dashboard:summary';
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    const metrics = ['active_users', 'page_views', 'events_per_second', 'error_rate', 'avg_response_time_ms'];
    const summary = { timestamp: new Date().toISOString(), metrics: {}, alerts: [] };

    for (const metric of metrics) {
      const [current, yesterday] = await Promise.all([
        pool.query(
          `SELECT value FROM metric_buckets
           WHERE metric_name = $1 AND granularity = '1m'
           ORDER BY bucket_start DESC LIMIT 1`,
          [metric]
        ),
        pool.query(
          `SELECT value FROM metric_buckets
           WHERE metric_name = $1 AND granularity = '1m'
             AND bucket_start >= NOW() - INTERVAL '1 day 1 minute'
             AND bucket_start <= NOW() - INTERVAL '1 day'
           ORDER BY bucket_start DESC LIMIT 1`,
          [metric]
        ),
      ]);

      const currentVal = current.rows[0] ? parseFloat(current.rows[0].value) : 0;
      const yesterdayVal = yesterday.rows[0] ? parseFloat(yesterday.rows[0].value) : 0;
      const changePct = yesterdayVal !== 0 ? ((currentVal - yesterdayVal) / yesterdayVal) * 100 : 0;

      summary.metrics[metric] = {
        current: currentVal,
        change_pct: Math.round(changePct * 10) / 10,
      };
    }

    await cache.set(cacheKey, summary, 30);
    res.json(summary);
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to build dashboard summary' }
    });
  }
});

app.post('/api/events', authenticate, rateLimit, async (req, res) => {
  const { events } = req.body;

  if (!Array.isArray(events) || events.length === 0) {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'events must be a non-empty array' }
    });
  }

  if (events.length > 100) {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Maximum 100 events per request' }
    });
  }

  const accepted = [];
  const errors = [];

  for (const event of events) {
    const validation = validateEvent(event);
    if (validation.valid) {
      accepted.push(event);
    } else {
      errors.push({ event: event.type, error: validation.error });
    }
  }

  // Enqueue accepted events
  if (accepted.length > 0) {
    try {
      const pipeline = redis.pipeline();
      for (const event of accepted) {
        pipeline.lpush('events:queue', JSON.stringify({
          ...event,
          timestamp: event.timestamp || new Date().toISOString(),
          received_at: new Date().toISOString(),
        }));
      }
      await pipeline.exec();
    } catch (err) {
      console.error('Queue error:', err);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to enqueue events' }
      });
    }
  }

  res.json({
    accepted: accepted.length,
    rejected: errors.length,
    errors,
  });
});

// ── Helpers ──────────────────────────────────────────────────────────

function autoGranularity(start, end) {
  const diffMs = new Date(end) - new Date(start);
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours <= 1) return '1m';
  if (diffHours <= 24) return '5m';
  if (diffHours <= 168) return '1h';
  return '1d';
}

// ── Start server ─────────────────────────────────────────────────────

const server = app.listen(config.port, () => {
  console.log(`ADS server listening on port ${config.port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  server.close();
  await pool.end();
  redis.disconnect();
  process.exit(0);
});

module.exports = { app, pool, redis, cache };
