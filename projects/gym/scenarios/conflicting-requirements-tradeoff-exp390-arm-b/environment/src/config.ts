export const config = {
  export: {
    maxTimeSeconds: 30,        // PM requirement: must complete within 30s
    maxMemoryMB: 256,          // Tech lead requirement: hard memory ceiling
    maxRowsPerExport: 10_000_000,
    csvDelimiter: ',',
    outputDir: '/tmp/exports',
  },
  infrastructure: {
    podMemoryMB: 512,          // total pod memory
    appReservedMB: 256,        // main app needs this much
    dbQueryRate: 150_000,      // rows/second for streaming reads
    dbBulkRate: 1_000_000,     // rows/second for bulk reads (but loads all to memory)
  }
};
