/**
 * Pipeline Tests
 * 
 * Tests both ordering and throughput requirements.
 * Note: These two requirements are in tension with each other.
 */

const { Pipeline, generateRecords } = require('../src/pipeline');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return fn().then(result => {
    if (result) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.log(`  ✗ ${name}`);
      failed++;
    }
  }).catch(err => {
    console.log(`  ✗ ${name}: ${err.message}`);
    failed++;
  });
}

async function runTests() {
  console.log('Pipeline Tests\n');

  // Test 1: Basic processing works
  await test('processes records successfully', async () => {
    const pipeline = new Pipeline();
    const records = generateRecords(5);
    const result = await pipeline.processBatch(records);
    return result.processed === 5 && result.errors === 0;
  });

  // Test 2: ORDER — records come out in sequence order
  await test('maintains strict ordering', async () => {
    const pipeline = new Pipeline();
    // Shuffle records to test ordering
    const records = generateRecords(10);
    const shuffled = [...records].sort(() => Math.random() - 0.5);
    const result = await pipeline.processBatch(shuffled);
    
    // Verify output is in order
    for (let i = 1; i < pipeline.processed.length; i++) {
      if (pipeline.processed[i].sequenceId <= pipeline.processed[i-1].sequenceId) {
        return false;
      }
    }
    return result.processed === 10;
  });

  // Test 3: Rejects out-of-order if order enforcement is still in place
  await test('rejects duplicate/out-of-order sequenceIds', async () => {
    const pipeline = new Pipeline();
    const records = [
      { sequenceId: 1, data: { id: 'a' } },
      { sequenceId: 2, data: { id: 'b' } },
      { sequenceId: 2, data: { id: 'c' } },  // duplicate
    ];
    const result = await pipeline.processBatch(records);
    return result.errors >= 1;  // At least one rejection
  });

  // Test 4: Handles invalid records
  await test('rejects records without data', async () => {
    const pipeline = new Pipeline();
    const records = [
      { sequenceId: 1, data: { id: 'a' } },
      { sequenceId: 2 },  // missing data
      { sequenceId: 3, data: { id: 'c' } },
    ];
    const result = await pipeline.processBatch(records);
    return result.errors >= 1;
  });

  // Test 5: THROUGHPUT — measures records per second
  // With current delays totaling ~5ms per record, max is ~200/sec sequential
  await test('throughput benchmark (200 records)', async () => {
    const pipeline = new Pipeline();
    const records = generateRecords(200);
    const result = await pipeline.processBatch(records);
    console.log(`    → Throughput: ${result.throughputPerSec} records/sec (target: 10,000)`);
    console.log(`    → Elapsed: ${result.elapsed}s for ${result.processed} records`);
    // This test PASSES regardless of throughput — it's just a measurement
    return result.processed === 200;
  });

  // Test 6: Large batch ordering
  await test('maintains ordering in large batch', async () => {
    const pipeline = new Pipeline();
    const records = generateRecords(50);
    const result = await pipeline.processBatch(records);
    
    for (let i = 1; i < pipeline.processed.length; i++) {
      if (pipeline.processed[i].sequenceId <= pipeline.processed[i-1].sequenceId) {
        return false;
      }
    }
    return result.processed === 50;
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
