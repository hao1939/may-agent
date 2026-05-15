import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateProject } from '../lib/project-template.js';
import { recordIteration, getMetrics } from '../lib/iteration-monitor.js';
import { analyzeIterations } from '../lib/session-analyzer.js';
import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

const TEST_LOG = path.join(tmpdir(), 'may-agent-smoke-test', 'iteration-log-smoke-test.json');

describe('Smoke Test: Integrated Toolkit', () => {
  beforeEach(() => {
    // Clear any existing test log
    if (fs.existsSync(TEST_LOG)) fs.unlinkSync(TEST_LOG);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_LOG)) fs.unlinkSync(TEST_LOG);
  });

  it('generates a project with proper structure', () => {
    const result = generateProject({
      name: 'smoke-test-project',
      goal: 'Validate integrated toolkit',
      metrics: [
        { name: 'test-coverage', target: '90%' },
        { name: 'pass-rate', target: '100%' },
      ],
      owner: 'test-runner',
    });

    expect(result.projectMd).toContain('smoke-test-project');
    expect(result.projectMd).toContain('Validate integrated toolkit');
    expect(result.projectMd).toContain('test-coverage');
    expect(result.projectMd).toContain('90%');
    expect(result.planItems.length).toBeGreaterThan(0);
  });

  it('records iterations and computes metrics', () => {
    const iterations = [
      { id: 'smoke-1', deliverableProduced: true, firstAttempt: true, durationMs: 1000 },
      { id: 'smoke-2', deliverableProduced: true, firstAttempt: false, durationMs: 2000 },
      { id: 'smoke-3', deliverableProduced: false, firstAttempt: true, durationMs: 500 },
      { id: 'smoke-4', deliverableProduced: true, firstAttempt: true, durationMs: 1500 },
      { id: 'smoke-5', deliverableProduced: true, firstAttempt: true, durationMs: 3000 },
    ];

    // Record iterations using the monitor
    for (const iter of iterations) {
      recordIteration(iter, TEST_LOG);
    }

    const metrics = getMetrics(undefined, TEST_LOG);
    expect(metrics.deliverableRate).toBeGreaterThanOrEqual(0.8);
    expect(metrics.firstAttemptRate).toBeGreaterThanOrEqual(0.8);
    expect(metrics.avgDuration).toBeGreaterThan(0);
  });

  it('analyzes iterations and produces suggestions', () => {
    const records = [
      { id: 'a1', deliverableProduced: true, firstAttempt: true, durationMs: 1000, timestamp: Date.now() },
      { id: 'a2', deliverableProduced: true, firstAttempt: true, durationMs: 1200, timestamp: Date.now() },
      { id: 'a3', deliverableProduced: false, firstAttempt: false, durationMs: 8000, timestamp: Date.now() },
      { id: 'a4', deliverableProduced: true, firstAttempt: true, durationMs: 900, timestamp: Date.now() },
      { id: 'a5', deliverableProduced: false, firstAttempt: false, durationMs: 7000, timestamp: Date.now() },
    ];

    const analysis = analyzeIterations(records);
    expect(analysis.slowest.length).toBeGreaterThan(0);
    expect(analysis.slowest[0].durationMs).toBeGreaterThanOrEqual(7000);
    expect(analysis.patterns.length).toBeGreaterThan(0);
    expect(analysis.suggestions.length).toBeGreaterThan(0);
  });

  it('full pipeline: generate project → record iterations → analyze', () => {
    // Step 1: Generate project
    const project = generateProject({
      name: 'pipeline-test',
      goal: 'Test full pipeline',
      metrics: [{ name: 'success-rate', target: '95%' }],
      owner: 'smoker',
    });
    expect(project.projectMd).toContain('pipeline-test');

    // Step 2: Simulate iterations
    const iterations = [
      { id: 'p1', deliverableProduced: true, firstAttempt: true, durationMs: 1100, timestamp: Date.now() },
      { id: 'p2', deliverableProduced: true, firstAttempt: true, durationMs: 1300, timestamp: Date.now() },
      { id: 'p3', deliverableProduced: true, firstAttempt: false, durationMs: 5000, timestamp: Date.now() },
      { id: 'p4', deliverableProduced: true, firstAttempt: true, durationMs: 900, timestamp: Date.now() },
      { id: 'p5', deliverableProduced: false, firstAttempt: false, durationMs: 6000, timestamp: Date.now() },
    ];

    // Step 3: Analyze
    const analysis = analyzeIterations(iterations);
    expect(analysis.slowest.length).toBeGreaterThan(0);
    
    // The slow ones should be flagged
    const slowIds = analysis.slowest.map(s => s.id);
    expect(slowIds).toContain('p5');
  });
});
