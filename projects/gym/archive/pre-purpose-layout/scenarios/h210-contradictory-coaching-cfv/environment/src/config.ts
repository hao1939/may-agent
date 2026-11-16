// config.ts — current implementation (neutral, no strong validation stance)
export interface AppConfig {
  port: number;
  logLevel: string;
  dbPath: string;
  features: Record<string, boolean>;
}

const defaults: AppConfig = {
  port: 3000,
  logLevel: 'info',
  dbPath: './data/app.db',
  features: {}
};

export function loadConfig(raw: unknown): AppConfig {
  if (typeof raw !== 'object' || raw === null) {
    return { ...defaults };
  }
  const obj = raw as Record<string, unknown>;
  return {
    port: typeof obj.port === 'number' ? obj.port : defaults.port,
    logLevel: typeof obj.logLevel === 'string' ? obj.logLevel : defaults.logLevel,
    dbPath: typeof obj.dbPath === 'string' ? obj.dbPath : defaults.dbPath,
    features: typeof obj.features === 'object' && obj.features !== null 
      ? obj.features as Record<string, boolean>
      : defaults.features
  };
}
