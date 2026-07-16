// config-loader.js — Loads configuration from multiple sources
const fs = require('fs');
const path = require('path');

function loadConfig() {
  const env = process.env.NODE_ENV || 'development';
  
  // 1. Load default.json
  const defaultConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config', 'default.json'), 'utf-8')
  );
  
  // 2. Load .env file (dotenv-style)
  const envFile = env === 'development' ? '.env' : `.env.${env}`;
  const envVars = {};
  try {
    const content = fs.readFileSync(path.join(__dirname, envFile), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...rest] = trimmed.split('=');
        envVars[key.trim()] = rest.join('=').trim();
      }
    }
  } catch {
    console.warn(`Warning: ${envFile} not found, using defaults`);
  }
  
  // 3. Environment variables from docker-compose override .env file
  // (docker-compose environment: section takes precedence)
  
  // 4. Merge: docker env vars > .env file > default.json
  // NOTE: This loader does NOT handle docker-compose env vars —
  // those are set by Docker at runtime. In development, we only see .env.
  
  return {
    port: parseInt(process.env.PORT || envVars.PORT || defaultConfig.server.port),
    host: defaultConfig.server.host,
    db: {
      host: process.env.DB_HOST || envVars.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || envVars.DB_PORT || '5432'),
      name: envVars.DB_NAME || 'auth_dev',
      user: envVars.DB_USER || 'auth_user',
      password: envVars.DB_PASSWORD || '',
      ssl: (process.env.DB_SSL || envVars.DB_SSL || 'false') === 'true',
      poolSize: parseInt(envVars.DB_POOL_SIZE || '5'),
    },
    redis: {
      url: process.env.REDIS_URL || envVars.REDIS_URL || 'redis://localhost:6379',
      password: envVars.REDIS_PASSWORD || undefined,
      tls: (envVars.REDIS_TLS || 'false') === 'true',
    },
    auth: {
      jwtSecret: envVars.JWT_SECRET || 'insecure-default',
      jwtExpiry: parseInt(envVars.JWT_EXPIRY || '3600'),
      refreshExpiry: parseInt(envVars.REFRESH_TOKEN_EXPIRY || '86400'),
      algorithm: defaultConfig.auth.tokenAlgorithm,
      bcryptRounds: defaultConfig.auth.bcryptRounds,
    },
    tls: {
      certPath: envVars.TLS_CERT_PATH || './certs/dev.crt',
      keyPath: envVars.TLS_KEY_PATH || './certs/dev.key',
      verify: (envVars.TLS_VERIFY || 'false') === 'true',
      // NOTE: rejectUnauthorized from default.json is separate from TLS_VERIFY in .env
      // This is a known inconsistency — default.json says false, but staging .env says true
      rejectUnauthorized: defaultConfig.tls.rejectUnauthorized,
    },
    rateLimit: {
      windowMs: parseInt(envVars.RATE_LIMIT_WINDOW || '60000'),
      max: parseInt(envVars.RATE_LIMIT_MAX || '100'),
    },
    authService: {
      url: envVars.AUTH_SERVICE_URL || 'http://localhost:3000',
      timeoutMs: parseInt(envVars.AUTH_TIMEOUT_MS || '5000'),
      retryCount: parseInt(envVars.AUTH_RETRY_COUNT || '3'),
    },
  };
}

module.exports = { loadConfig };
