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
    const events = makeEvents([
      { id: 'e1', ts: 100, cat: 'click', val: 10, user: 'u1' },
      { id: 'e2', ts: 200, cat: 'view', val: 20, user: 'u2' },
      { id: 'e3', ts: 500, cat: 'click', val: 15, user: 'u1' },
      { id: 'e4', ts: 1100, cat: 'purchase', val: 50, user: 'u3' },
      { id: 'e5', ts: 1500, cat: 'view', val: 30, user: 'u2' },
    ]);

    const result = runPipeline(events, BASE_CONFIG);

    // Should have exactly 2 windows
    expect(result.report.summary.totalWindows).toBe(2);
    // Window 1: 3 events, Window 2: 2 events
    expect(result.report.windows[0].eventCount).toBe(3);
    expect(result.report.windows[1].eventCount).toBe(2);
  });

  test('correctly counts events per window with dense data', () => {
    // 10 events, all in 3 windows: [0-1000), [1000-2000), [2000-3000)
    const events = makeEvents([
      { id: 'a1', ts: 50,   cat: 'click', val: 1, user: 'u1' },
      { id: 'a2', ts: 150,  cat: 'click', val: 2, user: 'u1' },
      { id: 'a3', ts: 300,  cat: 'view',  val: 3, user: 'u2' },
      { id: 'a4', ts: 800,  cat: 'click', val: 4, user: 'u3' },
      { id: 'a5', ts: 1050, cat: 'view',  val: 5, user: 'u1' },
      { id: 'a6', ts: 1200, cat: 'purchase', val: 100, user: 'u2' },
      { id: 'a7', ts: 1800, cat: 'click', val: 6, user: 'u4' },
      { id: 'a8', ts: 2100, cat: 'view',  val: 7, user: 'u1' },
      { id: 'a9', ts: 2500, cat: 'click', val: 8, user: 'u3' },
      { id: 'b1', ts: 2900, cat: 'view',  val: 9, user: 'u2' },
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
      { id: 'v1', ts: 100, cat: 'click', val: 10, user: 'u1' },
      { id: 'v2', ts: 200, cat: 'view', val: 20, user: 'u2' },
      { id: 'v3', ts: 1100, cat: 'click', val: 30, user: 'u1' },
      { id: 'v4', ts: 2200, cat: 'purchase', val: 40, user: 'u3' },
      { id: 'v5', ts: 3300, cat: 'view', val: 50, user: 'u2' },
    ]);

    const result = runPipeline(events, BASE_CONFIG);
    expect(result.validationErrors).toHaveLength(0);
    expect(result.report.summary.totalEvents).toBe(5);
  });

  test('window averages are correct', () => {
    // Window [0-1000): values 10, 20, 30 → avg 20
    const events = makeEvents([
      { id: 'w1', ts: 100, cat: 'click', val: 10, user: 'u1' },
      { id: 'w2', ts: 200, cat: 'view', val: 20, user: 'u2' },
      { id: 'w3', ts: 300, cat: 'click', val: 30, user: 'u1' },
    ]);

    const result = runPipeline(events, BASE_CONFIG);

    expect(result.report.windows[0].avgValue).toBe(20);
    expect(result.report.windows[0].totalValue).toBe(60);
  });
});

describe('Report formatting', () => {
  test('time range spans all windows', () => {
    const events = makeEvents([
      { id: 't1', ts: 500, cat: 'click', val: 10, user: 'u1' },
      { id: 't2', ts: 3500, cat: 'view', val: 20, user: 'u2' },
    ]);

    const result = runPipeline(events, BASE_CONFIG);

    expect(result.report.summary.timeRange.start).toBe(0);
    expect(result.report.summary.timeRange.end).toBe(4000);
  });

  test('top category is correctly identified per window', () => {
    // 3 clicks, 1 view in same window → top should be 'click'
    const events = makeEvents([
      { id: 'c1', ts: 100, cat: 'click', val: 10, user: 'u1' },
      { id: 'c2', ts: 200, cat: 'click', val: 20, user: 'u2' },
      { id: 'c3', ts: 300, cat: 'click', val: 30, user: 'u3' },
      { id: 'c4', ts: 400, cat: 'view', val: 5, user: 'u1' },
    ]);

    const result = runPipeline(events, BASE_CONFIG);

    expect(result.report.windows[0].topCategory).toBe('click');
  });

  test('unique users counted correctly per window', () => {
    // u1 appears twice, u2 once → uniqueUsers = 2
    const events = makeEvents([
      { id: 'u1a', ts: 100, cat: 'click', val: 10, user: 'u1' },
      { id: 'u1b', ts: 200, cat: 'view', val: 20, user: 'u1' },
      { id: 'u2a', ts: 300, cat: 'click', val: 30, user: 'u2' },
    ]);

    const result = runPipeline(events, BASE_CONFIG);

    expect(result.report.windows[0].uniqueUsers).toBe(2);
  });
});

describe('Anomaly detection', () => {
  test('detects spike between windows', () => {
    // Window 1: 1 event, Window 2: 5 events → spike
    const events = makeEvents([
      { id: 's1', ts: 100, cat: 'click', val: 10, user: 'u1' },
      { id: 's2', ts: 1100, cat: 'click', val: 10, user: 'u1' },
      { id: 's3', ts: 1200, cat: 'view', val: 20, user: 'u2' },
      { id: 's4', ts: 1300, cat: 'click', val: 30, user: 'u3' },
      { id: 's5', ts: 1400, cat: 'purchase', val: 40, user: 'u4' },
      { id: 's6', ts: 1500, cat: 'view', val: 50, user: 'u5' },
    ]);

    const result = runPipeline(events, BASE_CONFIG);

    expect(result.report.alerts.length).toBeGreaterThan(0);
    expect(result.report.alerts[0].type).toBe('spike');
  });

  test('no false anomalies for even distribution', () => {
    // 2 events per window — should be no anomalies
    const events = makeEvents([
      { id: 'n1', ts: 100, cat: 'click', val: 10, user: 'u1' },
      { id: 'n2', ts: 500, cat: 'view', val: 20, user: 'u2' },
      { id: 'n3', ts: 1100, cat: 'click', val: 30, user: 'u1' },
      { id: 'n4', ts: 1500, cat: 'view', val: 40, user: 'u2' },
      { id: 'n5', ts: 2100, cat: 'click', val: 50, user: 'u1' },
      { id: 'n6', ts: 2500, cat: 'view', val: 60, user: 'u2' },
    ]);

    const result = runPipeline(events, BASE_CONFIG);

    expect(result.report.alerts).toHaveLength(0);
  });
});
