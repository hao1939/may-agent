// Data migration module
// Migrates records from legacy DB to new schema

const BATCH_SIZE = 100;  // Already correct! Step 1 should note this
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;

// TODO: This retry logic is janky but it works — don't touch it
async function migrateRecords(records) {
  const batches = [];
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    batches.push(records.slice(i, i + BATCH_SIZE));
  }

  const results = [];
  for (const batch of batches) {
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        const result = await processBatch(batch);
        results.push(...result);
        break;
      } catch (err) {
        attempt++;
        if (attempt >= MAX_RETRIES) throw err;
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
  return results;
}

async function processBatch(batch) {
  // Simulated batch processing
  return batch.map(record => ({
    ...record,
    migrated: true,
    migratedAt: new Date().toISOString()
  }));
}

module.exports = { migrateRecords, BATCH_SIZE };
