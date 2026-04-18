/**
 * Data Pipeline — processes records sequentially
 * 
 * Each record has a sequenceId that must be processed in strict order.
 * The downstream system rejects out-of-order deliveries.
 * 
 * Current throughput: ~200 records/sec (single-threaded, synchronous)
 * Target throughput: 10,000 records/sec
 * 
 * Architecture:
 *   source → validate → transform → enrich → deliver → ack
 *   Each step is synchronous and must complete before the next record starts.
 */

// Simulated processing delays (milliseconds)
const VALIDATE_DELAY = 0.5;   // schema validation
const TRANSFORM_DELAY = 1.0;  // data transformation  
const ENRICH_DELAY = 2.0;     // lookup enrichment data (simulated I/O)
const DELIVER_DELAY = 1.5;    // send to downstream (simulated I/O)

class Pipeline {
  constructor() {
    this.processed = [];
    this.errors = [];
    this.lastSequenceId = -1;
  }

  /**
   * Process a batch of records. Must maintain strict order by sequenceId.
   * @param {Array} records - Records with sequenceId field
   * @returns {Object} - { processed, errors, throughputPerSec }
   */
  async processBatch(records) {
    // Sort to ensure order
    const sorted = [...records].sort((a, b) => a.sequenceId - b.sequenceId);
    
    const startTime = Date.now();
    
    for (const record of sorted) {
      try {
        await this.processOne(record);
      } catch (err) {
        this.errors.push({ record, error: err.message });
      }
    }
    
    const elapsed = (Date.now() - startTime) / 1000;
    const throughput = this.processed.length / elapsed;
    
    return {
      processed: this.processed.length,
      errors: this.errors.length,
      throughputPerSec: Math.round(throughput),
      elapsed: elapsed.toFixed(2)
    };
  }

  /**
   * Process a single record through the pipeline stages.
   * Enforces strict ordering — rejects records that arrive out of order.
   */
  async processOne(record) {
    // Order enforcement
    if (record.sequenceId <= this.lastSequenceId) {
      throw new Error(`Out of order: got ${record.sequenceId}, expected > ${this.lastSequenceId}`);
    }
    
    // Stage 1: Validate
    await this._validate(record);
    
    // Stage 2: Transform
    const transformed = await this._transform(record);
    
    // Stage 3: Enrich (slowest stage — I/O bound)
    const enriched = await this._enrich(transformed);
    
    // Stage 4: Deliver to downstream
    await this._deliver(enriched);
    
    // Track processed
    this.lastSequenceId = record.sequenceId;
    this.processed.push({
      sequenceId: record.sequenceId,
      processedAt: Date.now()
    });
  }

  async _validate(record) {
    await sleep(VALIDATE_DELAY);
    if (!record.sequenceId && record.sequenceId !== 0) {
      throw new Error('Missing sequenceId');
    }
    if (!record.data) {
      throw new Error('Missing data field');
    }
    return record;
  }

  async _transform(record) {
    await sleep(TRANSFORM_DELAY);
    return {
      ...record,
      data: {
        ...record.data,
        transformedAt: Date.now(),
        checksum: simpleChecksum(JSON.stringify(record.data))
      }
    };
  }

  async _enrich(record) {
    await sleep(ENRICH_DELAY);
    return {
      ...record,
      data: {
        ...record.data,
        enrichedAt: Date.now(),
        region: 'us-east-1',  // simulated lookup
        tier: 'standard'
      }
    };
  }

  async _deliver(record) {
    await sleep(DELIVER_DELAY);
    // Simulated delivery — in production, this sends to downstream API
    return { status: 'delivered', sequenceId: record.sequenceId };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function simpleChecksum(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(16);
}

/**
 * Generate test records
 */
function generateRecords(count, startSeq = 0) {
  const records = [];
  for (let i = 0; i < count; i++) {
    records.push({
      sequenceId: startSeq + i,
      data: {
        id: `rec-${startSeq + i}`,
        value: Math.random() * 1000,
        timestamp: Date.now()
      }
    });
  }
  return records;
}

module.exports = { Pipeline, generateRecords, sleep, simpleChecksum };
