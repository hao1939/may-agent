// pipeline.test.ts — Tests for the event processing pipeline
// These tests verify window aggregation and report correctness
//
// KNOWN ISSUE: Several tests started failing after the 2026-04-10 refactor.
// Symptoms: wrong window counts, events appearing in wrong windows,
// anomaly detection firing unexpectedly.
// Suspect: aggregator window boundary logic or formatter report generation

import { describe, test, expect, beforeEach } from 'bun:test';
import { runPipeline, PipelineConfig } from './src/pipeline';
import { RawEvent } from './src/source';
import { clearCache } from './src/aggregator';

beforeEach(() => {
  clearCache();
});

// Helper: create events spread across time windows
function makeEvents(specs: Array<{ id: string; ts: number; cat: string; val: number; user: string }>): RawEvent[] {
  return specs.map(s => ({
    id: s.id,
    timestamp: s.ts,
    category: s.cat,
    value: s.val,
    userId: s.user,
  }));
}

const BASE_CONFIG: PipelineConfig = {
  windowSizeMs: 1000,
  categories: ['click', 'view', 'purchase'],
};

describe('Pipeline window aggregation', () => {
  test('groups events into correct time windows', () => {
    // 3 events in window [0-1000), 2 events in window [1000-2000)
    // IDs intentionally don't match timestamp order (assigned by different system)
    const events = makeEvents([
      { id: 'mx-9', ts: 100,  cat: 'click', val: 10, user: 'u1' },
      { id: 'ax-3', ts: 200,  cat: 'view',  val: 20, user: 'u2' },
      { id: 'zx-1', ts: 500,  cat: 'click', val: 15, user: 'u1' },
      { id: 'bx-7', ts: 1100, cat: 'purchase', val: 50, user: 'u3' },
      { id: 'kx-2', ts: 1500, cat: 'view',  val: 30, user: 'u2' },
    ]);

    const result = runPipeline(events, BASE_CONFIG);

    // Should have exactly 2 windows
    expect(result.report.summary.totalWindows).toBe(2);
    // Window 1: 3 events, Window 2: 2 events
    expect(result.report.windows[0].eventCount).toBe(3);
    expect(result.report.windows[1].eventCount).toBe(2);
  });

  test('correctly counts events per window with dense data', () => {
    // 10 events across 3 windows: [0-1000), [1000-2000), [2000-3000)
    // IDs assigned by upstream service — NOT in timestamp order
    const events = makeEvents([
      { id: 'px-8', ts: 50,   cat: 'click', val: 1, user: 'u1' },
      { id: 'cx-2', ts: 150,  cat: 'click', val: 2, user: 'u1' },
      { id: 'rx-5', ts: 300,  cat: 'view',  val: 3, user: 'u2' },
      { id: 'ax-1', ts: 800,  cat: 'click', val: 4, user: 'u3' },
      { id: 'zx-9', ts: 1050, cat: 'view',  val: 5, user: 'u1' },
      { id: 'fx-3', ts: 1200, cat: 'purchase', val: 100, user: 'u2' },
      { id: 'wx-7', ts: 1800, cat: 'click', val: 6, user: 'u4' },
      { id: 'bx-4', ts: 2100, cat: 'view',  val: 7, user: 'u1' },
      { id: 'tx-6', ts: 2500, cat: 'click', val: 8, user: 'u3' },
      { id: 'hx-0', ts: 2900, cat: 'view',  val: 9, user: 'u2' },
    ]);

    const result = runPipeline(events, BASE_CONFIG);

    expect(result.report.summary.totalWindows).toBe(3);
    expect(result.report.summary.totalEvents).toBe(10);
    // Window counts: 4, 3, 3
    expect(result.report.windows[0].eventCount).toBe(4);
    expect(result.report.windows[1].eventCount).toBe(3);
    expect(result.report.windows[2].eventCount).toBe(3);
  });

  test('no event loss in validation', () => {
    const events = makeEvents([
      { id: 'qr-5', ts: 100,  cat: 'click', val: 10, user: 'u1' },
      { id: 'ab-1', ts: 200,  cat: 'view',  val: 20, user: 'u2' },
      { id: 'zz-9', ts: 1100, cat: 'click', val: 30, user: 'u1' },
      { id: 'mm-3', ts: 2200, cat: 'purchase', val: 40, user: 'u3' },
      { id: 'bb-2', ts: 3300, cat: 'view',  val: 50, user: 'u2' },
    ]);

    const result = runPipeline(events, BASE_CONFIG);
    expect(result.validationErrors).toHaveLength(0);
    expect(result.report.summary.totalEvents).toBe(5);
  });

  test('window averages are correct', () => {
    // Window [0-1000): values 10, 20, 30 → avg 20
    const events = makeEvents([
      { id: 'zz-3', ts: 100, cat: 'click', val: 10, user: 'u1' },
      { id: 'aa-1', ts: 200, cat: 'view',  val: 20, user: 'u2' },
      { id: 'mm-2', ts: 300, cat: 'click', val: 30, user: 'u1' },
    ]);

    const result = runPipeline(events, BASE_CONFIG);

    expect(result.report.windows[0].avgValue).toBe(20);
    expect(result.report.windows[0].totalValue).toBe(60);
  });
});

describe('Report formatting', () => {
  test('time range spans all windows', () => {
    const events = makeEvents([
      { id: 'zr-2', ts: 500,  cat: 'click', val: 10, user: 'u1' },
      { id: 'ar-1', ts: 3500, cat: 'view',  val: 20, user: 'u2' },
    ]);

    const result = runPipeline(events, BASE_CONFIG);

    expect(result.report.summary.timeRange.start).toBe(0);
    expect(result.report.summary.timeRange.end).toBe(4000);
  });

  test('top category is correctly identified per window', () => {
    // 3 clicks, 1 view in same window → top should be 'click'
    const events = makeEvents([
      { id: 'zc-4', ts: 100, cat: 'click', val: 10, user: 'u1' },
      { id: 'ac-1', ts: 200, cat: 'click', val: 20, user: 'u2' },
      { id: 'mc-3', ts: 300, cat: 'click', val: 30, user: 'u3' },
      { id: 'dc-2', ts: 400, cat: 'view',  val: 5,  user: 'u1' },
    ]);

    const result = runPipeline(events, BASE_CONFIG);

    expect(result.report.windows[0].topCategory).toBe('click');
  });

  test('unique users counted correctly per window', () => {
    // u1 appears twice, u2 once → uniqueUsers = 2
    const events = makeEvents([
      { id: 'zu-3', ts: 100, cat: 'click', val: 10, user: 'u1' },
      { id: 'au-1', ts: 200, cat: 'view',  val: 20, user: 'u1' },
      { id: 'mu-2', ts: 300, cat: 'click', val: 30, user: 'u2' },
    ]);

    const result = runPipeline(events, BASE_CONFIG);

    expect(result.report.windows[0].uniqueUsers).toBe(2);
  });
});

describe('Anomaly detection', () => {
  test('detects spike between windows', () => {
    // Window 1: 1 event, Window 2: 5 events → spike
    const events = makeEvents([
      { id: 'zs-6', ts: 100,  cat: 'click', val: 10, user: 'u1' },
      { id: 'as-1', ts: 1100, cat: 'click', val: 10, user: 'u1' },
      { id: 'ms-4', ts: 1200, cat: 'view',  val: 20, user: 'u2' },
      { id: 'bs-2', ts: 1300, cat: 'click', val: 30, user: 'u3' },
      { id: 'qs-5', ts: 1400, cat: 'purchase', val: 40, user: 'u4' },
      { id: 'ds-3', ts: 1500, cat: 'view',  val: 50, user: 'u5' },
    ]);

    const result = runPipeline(events, BASE_CONFIG);

    expect(result.report.alerts.length).toBeGreaterThan(0);
    expect(result.report.alerts[0].type).toBe('spike');
  });

  test('no false anomalies for even distribution', () => {
    // 2 events per window — should be no anomalies
    const events = makeEvents([
      { id: 'zn-6', ts: 100,  cat: 'click', val: 10, user: 'u1' },
      { id: 'an-1', ts: 500,  cat: 'view',  val: 20, user: 'u2' },
      { id: 'mn-4', ts: 1100, cat: 'click', val: 30, user: 'u1' },
      { id: 'bn-2', ts: 1500, cat: 'view',  val: 40, user: 'u2' },
      { id: 'qn-5', ts: 2100, cat: 'click', val: 50, user: 'u1' },
      { id: 'dn-3', ts: 2500, cat: 'view',  val: 60, user: 'u2' },
    ]);

    const result = runPipeline(events, BASE_CONFIG);

    expect(result.report.alerts).toHaveLength(0);
  });
});
