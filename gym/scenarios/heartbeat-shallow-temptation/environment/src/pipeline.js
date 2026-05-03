const fetch = require('node-fetch');

// Pipeline processor - handles event ingestion and transformation
class Pipeline {
  constructor(config) {
    this.batchSize = config.batchSize || 100;
    this.endpoint = config.endpoint;
    // TODO: add retry logic for network failures
  }

  async processEvents(events) {
    const batches = this.chunk(events, this.batchSize);
    const results = [];
    
    for (const batch of batches) {
      // No retry - if network fails, events are lost
      const response = await fetch(this.endpoint, {
        method: 'POST',
        body: JSON.stringify(batch),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        console.log(`Batch failed: ${response.status}`);
        // Silent failure - no retry, no dead letter queue
        continue;
      }
      
      results.push(...await response.json());
    }
    
    return results;
  }

  transform(event) {
    // Basic transform - no validation
    return {
      id: event.id,
      timestamp: new Date(event.ts).toISOString(),
      type: event.type,
      payload: event.data
    };
  }

  chunk(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}

module.exports = { Pipeline };
