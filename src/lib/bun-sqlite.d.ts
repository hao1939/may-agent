/**
 * Minimal type declarations for bun:sqlite.
 * The full Bun runtime provides this module; these types
 * allow TSC to compile without @types/bun installed.
 */
declare module "bun:sqlite" {
  interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  interface Statement<T = unknown> {
    get(...params: unknown[]): T | null;
    all(...params: unknown[]): T[];
    run(...params: unknown[]): RunResult;
    finalize(): void;
  }

  export class Database {
    constructor(filename?: string, options?: { create?: boolean; readwrite?: boolean; readonly?: boolean });
    run(sql: string, params?: unknown[]): RunResult;
    exec(sql: string): void;
    query<T = unknown>(sql: string): Statement<T>;
    close(): void;
    transaction<T>(fn: () => T): () => T;
  }
}
