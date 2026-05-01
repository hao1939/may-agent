import { Readable } from 'stream';

export interface QueryResult {
  columns: string[];
  rows: any[][];
}

export interface DataStore {
  /**
   * Returns all results at once. Fast (~10s for 10M rows) but loads everything into memory.
   * Memory usage: ~300 bytes per row → 10M rows = ~3GB
   */
  queryAll(sql: string): Promise<QueryResult>;
  
  /**
   * Returns a readable stream of row chunks (1000 rows per chunk).
   * Memory-efficient (~50MB peak) but slow for large datasets (~60-90s for 10M rows).
   */
  queryStream(sql: string): Readable;
  
  /**
   * Returns estimated row count for a query (fast, uses EXPLAIN).
   */
  estimateCount(sql: string): Promise<number>;
}

// Pre-configured instance connected to analytics DB
export const dataStore: DataStore = {} as any; // initialized at runtime
