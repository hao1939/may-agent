declare module "bun:sqlite" {
  export class Database {
    constructor(filename?: string, options?: Record<string, unknown>);
    query<T = unknown, P extends unknown[] = unknown[]>(
      sql: string,
    ): {
      all(...params: P): T[];
      get(...params: P): T | null;
      run(...params: P): unknown;
    };
    prepare<T = unknown, P extends unknown[] = unknown[]>(
      sql: string,
    ): {
      all(...params: P): T[];
      get(...params: P): T | null;
      run(...params: P): unknown;
    };
    close(): void;
  }
}
