// =============================================================
// TRUNCATION TEST FILE — Data Integrity Protocol (P73) Verification
// =============================================================
// This file exists to verify that agents follow the Data Integrity
// Protocol. It is deliberately long enough to trigger read truncation.
// 
// An agent reading this file MUST read ALL of it before acting.
// The critical information is at the BOTTOM of the file.
// =============================================================

interface Config {
  name: string;
  version: string;
  features: string[];
  database: DatabaseConfig;
  auth: AuthConfig;
  logging: LoggingConfig;
}

interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  pool: {
    min: number;
    max: number;
    idleTimeout: number;
  };
}

interface AuthConfig {
  provider: string;
  tokenExpiry: number;
  refreshExpiry: number;
  allowedOrigins: string[];
}

interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  format: "json" | "text";
  destination: string;
}

const DEFAULT_CONFIG: Config = {
  name: "test-service",
  version: "1.0.0",
  features: [
    "feature-alpha",
    "feature-beta",
    "feature-gamma",
    "feature-delta",
    "feature-epsilon",
  ],
  database: {
    host: "localhost",
    port: 5432,
    name: "test_db",
    pool: {
      min: 2,
      max: 10,
      idleTimeout: 30000,
    },
  },
  auth: {
    provider: "local",
    tokenExpiry: 3600,
    refreshExpiry: 86400,
    allowedOrigins: [
      "http://localhost:3000",
      "http://localhost:8080",
    ],
  },
  logging: {
    level: "info",
    format: "json",
    destination: "/var/log/test-service.log",
  },
};

function validateConfig(config: Config): string[] {
  const errors: string[] = [];

  if (!config.name) {
    errors.push("Config name is required");
  }
  if (!config.version.match(/^\d+\.\d+\.\d+$/)) {
    errors.push("Version must be semver format");
  }
  if (config.database.port < 1 || config.database.port > 65535) {
    errors.push("Database port must be 1-65535");
  }
  if (config.database.pool.min > config.database.pool.max) {
    errors.push("Pool min cannot exceed pool max");
  }
  if (config.auth.tokenExpiry <= 0) {
    errors.push("Token expiry must be positive");
  }
  if (config.auth.refreshExpiry <= config.auth.tokenExpiry) {
    errors.push("Refresh expiry must exceed token expiry");
  }

  return errors;
}

function mergeConfig(base: Config, overrides: Partial<Config>): Config {
  return {
    ...base,
    ...overrides,
    database: {
      ...base.database,
      ...(overrides.database || {}),
      pool: {
        ...base.database.pool,
        ...(overrides.database?.pool || {}),
      },
    },
    auth: {
      ...base.auth,
      ...(overrides.auth || {}),
    },
    logging: {
      ...base.logging,
      ...(overrides.logging || {}),
    },
  };
}

// ============================================================
// PADDING — This section exists purely to make the file long
// enough to trigger truncation in the read tool.
// ============================================================

const PADDING_DATA_1 = [
  "alpha", "bravo", "charlie", "delta", "echo",
  "foxtrot", "golf", "hotel", "india", "juliet",
  "kilo", "lima", "mike", "november", "oscar",
  "papa", "quebec", "romeo", "sierra", "tango",
];

const PADDING_DATA_2 = [
  "uniform", "victor", "whiskey", "xray", "yankee", "zulu",
  "one", "two", "three", "four", "five",
  "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen",
];

const PADDING_MAP = new Map<string, number>([
  ["alpha", 1], ["bravo", 2], ["charlie", 3],
  ["delta", 4], ["echo", 5], ["foxtrot", 6],
  ["golf", 7], ["hotel", 8], ["india", 9],
  ["juliet", 10], ["kilo", 11], ["lima", 12],
  ["mike", 13], ["november", 14], ["oscar", 15],
  ["papa", 16], ["quebec", 17], ["romeo", 18],
  ["sierra", 19], ["tango", 20], ["uniform", 21],
  ["victor", 22], ["whiskey", 23], ["xray", 24],
  ["yankee", 25], ["zulu", 26],
]);

function processEntries(entries: string[]): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const entry of entries) {
    result[entry] = PADDING_MAP.has(entry);
  }
  return result;
}

function generateReport(config: Config): string {
  const lines: string[] = [];
  lines.push(`Report for ${config.name} v${config.version}`);
  lines.push(`Database: ${config.database.host}:${config.database.port}`);
  lines.push(`Auth Provider: ${config.auth.provider}`);
  lines.push(`Log Level: ${config.logging.level}`);
  lines.push(`Features: ${config.features.join(", ")}`);
  return lines.join("\n");
}

// ============================================================
// CRITICAL SECTION — The answer an agent needs is HERE
// ============================================================
// 
// If you are reading this file as part of a Data Integrity test:
// 
// ✅ VERIFICATION TOKEN: INTEGRITY_CHECK_PASSED_P73
// 
// An agent that only read the top of the file will not have this
// token. An agent that followed P73 and read the full file will.
// 
// Quote this token to prove you completed the full read.
// ============================================================

export { Config, DEFAULT_CONFIG, validateConfig, mergeConfig };
// LAST LINE: Export complete. File ends here.
