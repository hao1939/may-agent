import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { recordUsage, getUsageSummary } from '../cost-tracker.js';
import { unlinkSync } from 'fs';
import { join } from 'path';

const LOG_PATH = join(process.cwd(), '.state', 'usage-log.json');

describe('cost-tracker', () => {
  beforeEach(() => { try { unlinkSync(LOG_PATH); } catch {} });
  afterEach(() => { try { unlinkSync(LOG_PATH); } catch {} });

  it('returns empty summary when no data', () => {
    const summary = getUsageSummary();
    expect(summary.byAgent).toEqual({});
    expect(summary.byWorkflow).toEqual({});
  });

  it('records usage and summarizes by agent', () => {
    recordUsage({ agent: 'worker-1', promptTokens: 100, completionTokens: 50 });
    recordUsage({ agent: 'worker-1', promptTokens: 200, completionTokens: 100 });
    const summary = getUsageSummary();
    expect(summary.byAgent['worker-1'].total).toBe(450);
    expect(summary.byAgent['worker-1'].avg).toBe(225);
    expect(summary.byAgent['worker-1'].count).toBe(2);
  });

  it('summarizes by workflow', () => {
    recordUsage({ agent: 'a', workflow: 'deploy', promptTokens: 500, completionTokens: 200 });
    recordUsage({ agent: 'b', workflow: 'deploy', promptTokens: 300, completionTokens: 100 });
    const summary = getUsageSummary();
    expect(summary.byWorkflow['deploy'].total).toBe(1100);
    expect(summary.byWorkflow['deploy'].count).toBe(2);
  });

  it('filters by time window', () => {
    recordUsage({ agent: 'a', promptTokens: 100, completionTokens: 50 });
    // All records are recent, so filtering by 1 hour should include them
    const summary = getUsageSummary(1);
    expect(summary.byAgent['a'].total).toBe(150);
  });

  it('excludes old records when filtering by time', () => {
    // Manually write an old record
    const { writeFileSync, mkdirSync } = require('fs');
    const { dirname } = require('path');
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    const oldRecord = [{ agent: 'old', promptTokens: 999, completionTokens: 1, timestamp: 1000 }];
    writeFileSync(LOG_PATH, JSON.stringify(oldRecord));
    const summary = getUsageSummary(1);
    expect(summary.byAgent['old']).toBeUndefined();
  });

  it('handles multiple agents', () => {
    recordUsage({ agent: 'a', promptTokens: 100, completionTokens: 0 });
    recordUsage({ agent: 'b', promptTokens: 200, completionTokens: 0 });
    const summary = getUsageSummary();
    expect(Object.keys(summary.byAgent)).toHaveLength(2);
    expect(summary.byAgent['a'].total).toBe(100);
    expect(summary.byAgent['b'].total).toBe(200);
  });
});
