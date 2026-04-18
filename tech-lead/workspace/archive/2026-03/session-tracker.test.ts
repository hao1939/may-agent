import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// NOTE: These tests cover the existing SessionTracker functionality.
// The session-analytics feature (getAgentReport, getHealthReport) is NOT YET IMPLEMENTED.
// Tests for analytics should be added once the feature is built.

import { SessionTracker } from './session-tracker';

describe('SessionTracker', () => {
  let tracker: SessionTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    tracker = new SessionTracker({
      maxConcurrentSessions: 3,
      stallThresholdMs: 5000,
      maxMemoryPerSessionMB: 256,
      cleanupIntervalMs: 1000,
    });
  });

  afterEach(() => {
    tracker.stop();
    vi.useRealTimers();
  });

  describe('register', () => {
    it('should register a new session', () => {
      expect(tracker.register('s1', 'coder')).toBe(true);
      const session = tracker.getSession('s1');
      expect(session).toBeDefined();
      expect(session!.agent).toBe('coder');
      expect(session!.status).toBe('active');
    });

    it('should reject when at capacity', () => {
      tracker.register('s1', 'coder');
      tracker.register('s2', 'qa');
      tracker.register('s3', 'scout');
      expect(tracker.register('s4', 'bob')).toBe(false);
    });
  });

  describe('recordActivity', () => {
    it('should update turn count and last activity', () => {
      tracker.register('s1', 'coder');
      vi.advanceTimersByTime(1000);
      tracker.recordActivity('s1', 128);
      const session = tracker.getSession('s1');
      expect(session!.turnCount).toBe(1);
      expect(session!.memoryUsageMB).toBe(128);
    });

    it('should be no-op for unknown session', () => {
      tracker.recordActivity('nonexistent');
      // Should not throw
    });
  });

  describe('getOverMemorySessions', () => {
    it('should return sessions over the memory limit', () => {
      tracker.register('s1', 'coder');
      tracker.register('s2', 'qa');
      tracker.recordActivity('s1', 300); // Over 256 limit
      tracker.recordActivity('s2', 200); // Under limit
      const over = tracker.getOverMemorySessions();
      expect(over.length).toBe(1);
      expect(over[0].id).toBe('s1');
    });

    it('should return session at exactly the limit', () => {
      tracker.register('s1', 'coder');
      tracker.recordActivity('s1', 256); // Exactly at limit
      const over = tracker.getOverMemorySessions();
      // Sessions AT the limit should be flagged
      expect(over.length).toBe(1);
    });
  });

  describe('getSummary', () => {
    it('should return correct counts', () => {
      tracker.register('s1', 'coder');
      tracker.register('s2', 'qa');
      tracker.recordActivity('s1', 100);
      tracker.recordActivity('s1', 150);
      tracker.recordActivity('s2', 50);

      const summary = tracker.getSummary();
      expect(summary.total).toBe(2);
      expect(summary.active).toBe(2);
      expect(summary.stalled).toBe(0);
      expect(summary.totalMemoryMB).toBe(200);
      expect(summary.avgTurns).toBe(1.5);
    });

    it('should handle empty tracker', () => {
      const summary = tracker.getSummary();
      expect(summary.total).toBe(0);
      expect(summary.avgTurns).toBe(0);
    });
  });

  describe('stall detection', () => {
    it('should mark inactive sessions as stalled', () => {
      tracker.start();
      tracker.register('s1', 'coder');
      vi.advanceTimersByTime(6000); // Past 5000ms stall threshold
      const session = tracker.getSession('s1');
      expect(session!.status).toBe('stalled');
    });

    it('should not mark active sessions as stalled', () => {
      tracker.start();
      tracker.register('s1', 'coder');
      vi.advanceTimersByTime(3000);
      tracker.recordActivity('s1');
      vi.advanceTimersByTime(3000);
      const session = tracker.getSession('s1');
      expect(session!.status).toBe('active');
    });
  });

  describe('getSessionsByAgent', () => {
    it('should filter by agent name', () => {
      tracker.register('s1', 'coder');
      tracker.register('s2', 'coder');
      tracker.register('s3', 'qa');
      const coderSessions = tracker.getSessionsByAgent('coder');
      expect(coderSessions.length).toBe(2);
    });
  });

  describe('getAgentReport', () => {
    it('should return correct report for an agent with multiple sessions', () => {
      tracker.register('s1', 'coder');
      tracker.register('s2', 'coder');
      tracker.register('s3', 'qa');
      tracker.recordActivity('s1', 100);
      tracker.recordActivity('s1', 150);
      tracker.recordActivity('s2', 200);

      const report = tracker.getAgentReport('coder');
      expect(report.totalSessions).toBe(2);
      expect(report.activeSessions).toBe(2);
      expect(report.totalTurns).toBe(3); // s1 has 2 turns, s2 has 1 turn
      expect(report.avgMemoryMB).toBe(175); // (150 + 200) / 2
      expect(report.stalledCount).toBe(0);
    });

    it('should return zero values for unknown agent', () => {
      const report = tracker.getAgentReport('nonexistent');
      expect(report.totalSessions).toBe(0);
      expect(report.activeSessions).toBe(0);
      expect(report.totalTurns).toBe(0);
      expect(report.avgMemoryMB).toBe(0);
      expect(report.stalledCount).toBe(0);
    });

    it('should count stalled sessions correctly', () => {
      tracker.register('s1', 'coder');
      tracker.recordActivity('s1', 100);
      tracker.start();
      vi.advanceTimersByTime(6000); // Past 5000ms stall threshold

      const report = tracker.getAgentReport('coder');
      expect(report.totalSessions).toBe(1);
      expect(report.activeSessions).toBe(0);
      expect(report.stalledCount).toBe(1);
    });
  });

  describe('getHealthReport', () => {
    it('should return correct utilization with some sessions', () => {
      tracker.register('s1', 'coder');
      tracker.register('s2', 'qa');
      // maxConcurrentSessions is 3, so 2/3 * 100 = 66.67
      const report = tracker.getHealthReport();
      expect(report.utilizationPercent).toBeCloseTo(66.67, 1);
    });

    it("should return 'low' memory pressure with light usage", () => {
      tracker.register('s1', 'coder');
      tracker.recordActivity('s1', 50);
      // totalMax = 3 * 256 = 768, used = 50, ratio ~6.5% => low
      const report = tracker.getHealthReport();
      expect(report.memoryPressure).toBe('low');
    });

    it("should return 'high' memory pressure with heavy usage", () => {
      tracker.register('s1', 'coder');
      tracker.register('s2', 'qa');
      tracker.register('s3', 'scout');
      // totalMax = 3 * 256 = 768
      // Push each to >80%: 768 * 0.8 = 614.4, so need > 614.4 total
      tracker.recordActivity('s1', 250);
      tracker.recordActivity('s2', 250);
      tracker.recordActivity('s3', 250);
      // total used = 750, ratio = 750/768 ~97.7% => high
      const report = tracker.getHealthReport();
      expect(report.memoryPressure).toBe('high');
    });

    it('should return correct agentsActive list', () => {
      tracker.register('s1', 'coder');
      tracker.register('s2', 'qa');
      tracker.register('s3', 'coder');

      const report = tracker.getHealthReport();
      expect(report.agentsActive.sort()).toEqual(['coder', 'qa']);
    });

    it('should return safe defaults when empty', () => {
      const report = tracker.getHealthReport();
      expect(report.utilizationPercent).toBe(0);
      expect(report.stalledPercent).toBe(0);
      expect(report.memoryPressure).toBe('low');
      expect(report.agentsActive).toEqual([]);
    });
  });
});
