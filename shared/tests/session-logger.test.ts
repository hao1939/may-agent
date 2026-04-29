import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLogger, Logger, LogEvent } from '../workflows/session-logger';
import * as fs from 'fs';
import * as path from 'path';

const TEST_LOG = path.join(__dirname, '.tmp-test-session.log');

describe('session-logger', () => {
  let logger: Logger;

  beforeEach(() => {
    if (fs.existsSync(TEST_LOG)) fs.unlinkSync(TEST_LOG);
    logger = createLogger(TEST_LOG);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_LOG)) fs.unlinkSync(TEST_LOG);
  });

  it('creates log file on first write', () => {
    logger.log({ type: 'iteration-start' });
    expect(fs.existsSync(TEST_LOG)).toBe(true);
  });

  it('logs single event with timestamp', () => {
    logger.log({ type: 'iteration-start', task: 'test task' });
    const events = logger.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('iteration-start');
    expect(events[0].task).toBe('test task');
    expect(events[0].timestamp).toBeDefined();
  });

  it('logs multiple events in order', () => {
    logger.log({ type: 'iteration-start' });
    logger.log({ type: 'checkpoint' });
    logger.log({ type: 'iteration-end', outcome: 'success' });
    const events = logger.getEvents();
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('iteration-start');
    expect(events[2].type).toBe('iteration-end');
  });

  it('preserves custom timestamp if provided', () => {
    const ts = '2024-01-15T10:00:00.000Z';
    logger.log({ type: 'iteration-start', timestamp: ts });
    const events = logger.getEvents();
    expect(events[0].timestamp).toBe(ts);
  });

  it('logs error events with message', () => {
    logger.log({ type: 'error', error: 'connection failed' });
    const events = logger.getEvents();
    expect(events[0].error).toBe('connection failed');
  });

  it('logs duration on iteration-end', () => {
    logger.log({ type: 'iteration-end', duration: 5000, outcome: 'success' });
    const events = logger.getEvents();
    expect(events[0].duration).toBe(5000);
  });

  it('logs metadata', () => {
    logger.log({ type: 'custom', metadata: { key: 'value', count: 42 } });
    const events = logger.getEvents();
    expect(events[0].metadata).toEqual({ key: 'value', count: 42 });
  });

  // Filter tests
  it('filters by type', () => {
    logger.log({ type: 'iteration-start' });
    logger.log({ type: 'error', error: 'fail' });
    logger.log({ type: 'iteration-end', outcome: 'failure' });
    const errors = logger.getEvents({ type: 'error' });
    expect(errors).toHaveLength(1);
    expect(errors[0].error).toBe('fail');
  });

  it('filters by outcome', () => {
    logger.log({ type: 'iteration-end', outcome: 'success', duration: 100 });
    logger.log({ type: 'iteration-end', outcome: 'failure', duration: 200 });
    logger.log({ type: 'iteration-end', outcome: 'success', duration: 150 });
    const successes = logger.getEvents({ outcome: 'success' });
    expect(successes).toHaveLength(2);
  });

  it('filters by since timestamp', () => {
    logger.log({ type: 'iteration-start', timestamp: '2024-01-01T00:00:00Z' });
    logger.log({ type: 'iteration-start', timestamp: '2024-06-01T00:00:00Z' });
    const recent = logger.getEvents({ since: '2024-03-01T00:00:00Z' });
    expect(recent).toHaveLength(1);
  });

  it('filters by until timestamp', () => {
    logger.log({ type: 'iteration-start', timestamp: '2024-01-01T00:00:00Z' });
    logger.log({ type: 'iteration-start', timestamp: '2024-06-01T00:00:00Z' });
    const old = logger.getEvents({ until: '2024-03-01T00:00:00Z' });
    expect(old).toHaveLength(1);
  });

  it('combines multiple filters', () => {
    logger.log({ type: 'iteration-end', outcome: 'success', timestamp: '2024-01-01T00:00:00Z' });
    logger.log({ type: 'iteration-end', outcome: 'failure', timestamp: '2024-06-01T00:00:00Z' });
    logger.log({ type: 'error', outcome: 'failure', timestamp: '2024-06-02T00:00:00Z' });
    const result = logger.getEvents({ type: 'iteration-end', outcome: 'failure' });
    expect(result).toHaveLength(1);
  });

  // Summary tests
  it('computes summary with no events', () => {
    const s = logger.summary();
    expect(s.totalIterations).toBe(0);
    expect(s.successRate).toBe(0);
    expect(s.avgDuration).toBe(0);
    expect(s.errorCount).toBe(0);
    expect(s.firstEvent).toBeNull();
    expect(s.lastEvent).toBeNull();
  });

  it('computes summary with iterations', () => {
    logger.log({ type: 'iteration-end', outcome: 'success', duration: 1000 });
    logger.log({ type: 'iteration-end', outcome: 'success', duration: 2000 });
    logger.log({ type: 'iteration-end', outcome: 'failure', duration: 3000 });
    const s = logger.summary();
    expect(s.totalIterations).toBe(3);
    expect(s.successRate).toBeCloseTo(2 / 3);
    expect(s.avgDuration).toBe(2000);
  });

  it('counts errors in summary', () => {
    logger.log({ type: 'error', error: 'e1' });
    logger.log({ type: 'error', error: 'e2' });
    logger.log({ type: 'iteration-end', outcome: 'failure' });
    const s = logger.summary();
    expect(s.errorCount).toBe(3); // 2 error type + 1 failure outcome
  });

  it('tracks first and last event timestamps', () => {
    logger.log({ type: 'iteration-start', timestamp: '2024-01-01T00:00:00Z' });
    logger.log({ type: 'iteration-end', timestamp: '2024-01-01T01:00:00Z' });
    const s = logger.summary();
    expect(s.firstEvent).toBe('2024-01-01T00:00:00Z');
    expect(s.lastEvent).toBe('2024-01-01T01:00:00Z');
  });

  // Clear tests
  it('clear removes all events', () => {
    logger.log({ type: 'iteration-start' });
    logger.log({ type: 'iteration-end', outcome: 'success' });
    logger.clear();
    expect(logger.getEvents()).toHaveLength(0);
  });

  // Edge cases
  it('handles missing log file gracefully', () => {
    if (fs.existsSync(TEST_LOG)) fs.unlinkSync(TEST_LOG);
    const freshLogger = createLogger(TEST_LOG);
    expect(freshLogger.getEvents()).toEqual([]);
    expect(freshLogger.summary().totalIterations).toBe(0);
  });

  it('handles empty log file', () => {
    fs.writeFileSync(TEST_LOG, '', 'utf-8');
    expect(logger.getEvents()).toEqual([]);
  });

  it('handles corrupted lines gracefully', () => {
    fs.writeFileSync(TEST_LOG, '{"type":"iteration-start","timestamp":"2024-01-01T00:00:00Z"}\nnot json\n{"type":"error","timestamp":"2024-01-02T00:00:00Z"}\n');
    const events = logger.getEvents();
    expect(events).toHaveLength(2);
  });

  it('creates parent directories if they dont exist', () => {
    const deepPath = path.join(__dirname, '.tmp-deep', 'nested', 'test.log');
    const deepLogger = createLogger(deepPath);
    deepLogger.log({ type: 'iteration-start' });
    expect(fs.existsSync(deepPath)).toBe(true);
    // cleanup
    fs.rmSync(path.join(__dirname, '.tmp-deep'), { recursive: true });
  });

  it('supports concurrent appends', () => {
    // Simulate rapid sequential writes
    for (let i = 0; i < 50; i++) {
      logger.log({ type: 'custom', metadata: { i } });
    }
    const events = logger.getEvents();
    expect(events).toHaveLength(50);
  });
});
