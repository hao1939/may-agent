/**
 * Integration tests for the queue management system.
 * 
 * NOTE: These tests depend on @external/queue-lib which provides the
 * distributed queue backend. This package is only available in the CI
 * environment and is NOT installed locally.
 * 
 * These tests are expected to fail in local/container environments
 * where @external/queue-lib is not available.
 */
import { describe, it, expect } from 'vitest';
// This import will fail — the package doesn't exist in this environment
import { DistributedQueue } from '@external/queue-lib';
import { QueueMetrics } from '@external/queue-metrics';

describe('Distributed Queue Integration', () => {
  it('should sync tasks across nodes', async () => {
    const queue = new DistributedQueue({ nodes: ['localhost:6379'] });
    await queue.connect();
    await queue.push({ id: 'test-1', priority: 5 });
    const task = await queue.pop();
    expect(task.id).toBe('test-1');
    await queue.disconnect();
  });

  it('should report queue metrics', async () => {
    const metrics = new QueueMetrics();
    const stats = await metrics.collect();
    expect(stats.pending).toBeGreaterThanOrEqual(0);
    expect(stats.processed).toBeGreaterThanOrEqual(0);
  });

  it('should handle node failures gracefully', async () => {
    const queue = new DistributedQueue({ 
      nodes: ['localhost:6379', 'localhost:6380'],
      failover: true 
    });
    await queue.connect();
    // Simulate node failure
    await queue.simulateNodeFailure('localhost:6379');
    // Should still work via second node
    await queue.push({ id: 'failover-test', priority: 10 });
    const task = await queue.pop();
    expect(task.id).toBe('failover-test');
    await queue.disconnect();
  });
});
