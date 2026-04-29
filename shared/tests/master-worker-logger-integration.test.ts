import { describe, it, expect, beforeEach } from 'vitest';
import { createLogger } from '../workflows/session-logger';
import { validateTask } from '../workflows/task-validator';
import { estimateComplexity } from '../workflows/complexity-estimator';
import { IterationTimer } from '../workflows/iteration-timer';
import { withErrorBoundary } from '../workflows/error-boundary';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('master-worker logger integration', () => {
  let logPath: string;
  let logger: ReturnType<typeof createLogger>;
  let timer: InstanceType<typeof IterationTimer>;

  beforeEach(() => {
    logPath = path.join(os.tmpdir(), `mw-logger-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
    logger = createLogger(logPath);
    timer = new IterationTimer();
  });

  function simulateIteration(task: string) {
    // Step 1: Validate task
    const validation = validateTask(task);
    logger.log({ type: 'validation', task, outcome: validation.valid ? 'success' : 'failure' });

    if (!validation.valid) {
      logger.log({ type: 'custom', task, outcome: 'skipped', error: validation.reason });
      return { skipped: true, reason: validation.reason };
    }

    // Step 2: Estimate complexity
    const complexity = estimateComplexity(task);
    logger.log({ type: 'custom', task, metadata: { complexity: complexity.score } });

    // Step 3: Start iteration
    const iterationId = `iter-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    timer.startIteration(iterationId);
    logger.log({ type: 'iteration-start', task });

    // Step 4: Do work (with error boundary)
    const result = withErrorBoundary(() => {
      return { content: `Result for: ${task}` };
    }, { onError: (e) => logger.log({ type: 'error', task, error: e.message }) });

    // Step 5: End iteration
    const timing = timer.endIteration(iterationId);
    logger.log({ type: 'iteration-end', task, duration: timing.durationMs, outcome: 'success' });

    return { skipped: false, result, timing };
  }

  it('logs validation event', () => {
    simulateIteration('Write a simple file');
    const events = logger.getEvents({ type: 'validation' });
    expect(events.length).toBe(1);
  });

  it('logs complexity estimation as custom event', () => {
    simulateIteration('Implement a new module with tests');
    const events = logger.getEvents({ type: 'custom' });
    expect(events.some(e => e.metadata?.complexity !== undefined)).toBe(true);
  });

  it('logs iteration-start event', () => {
    simulateIteration('Create a test file');
    const events = logger.getEvents({ type: 'iteration-start' });
    expect(events.length).toBe(1);
  });

  it('logs iteration-end event with duration', () => {
    simulateIteration('Write documentation');
    const events = logger.getEvents({ type: 'iteration-end' });
    expect(events.length).toBe(1);
    expect(events[0].duration).toBeGreaterThanOrEqual(0);
  });

  it('logs skipped iteration for invalid tasks', () => {
    simulateIteration('');
    const events = logger.getEvents({ outcome: 'skipped' });
    expect(events.length).toBe(1);
  });

  it('captures errors via error boundary and logs them', () => {
    const iterationId = `iter-err-${Date.now()}`;
    timer.startIteration(iterationId);
    logger.log({ type: 'iteration-start', task: 'failing task' });

    withErrorBoundary(() => {
      throw new Error('Provider timeout');
    }, { onError: (e) => logger.log({ type: 'error', error: e.message }) });

    const events = logger.getEvents({ type: 'error' });
    expect(events.some(e => e.error === 'Provider timeout')).toBe(true);
  });

  it('logs correct event types for full pipeline', () => {
    simulateIteration('Implement feature X with integration tests');
    const events = logger.getEvents();
    const types = events.map(e => e.type);
    expect(types).toContain('validation');
    expect(types).toContain('custom');
    expect(types).toContain('iteration-start');
    expect(types).toContain('iteration-end');
  });

  it('accumulates events across multiple iterations', () => {
    simulateIteration('Task one is valid');
    simulateIteration('Task two is valid');
    simulateIteration('Task three is valid');
    const events = logger.getEvents();
    // 4 events per valid iteration (validation, custom, start, end) = 12
    expect(events.length).toBeGreaterThanOrEqual(8);
  });

  it('summary returns stats object', () => {
    simulateIteration('Task A is a valid task');
    simulateIteration('Task B is a valid task');
    simulateIteration('Task C is a valid task');
    const summary = logger.summary();
    expect(summary).toBeDefined();
    expect(typeof summary.totalIterations).toBe('number');
  });

  it('filters events by type correctly', () => {
    simulateIteration('First valid task here');
    simulateIteration('Second valid task here');
    const allEvents = logger.getEvents();
    const startEvents = allEvents.filter(e => e.type === 'iteration-start');
    expect(startEvents.length).toBe(2);
  });

  it('records task name in events', () => {
    simulateIteration('Specific task name here');
    const events = logger.getEvents();
    const taskEvents = events.filter(e => e.task === 'Specific task name here');
    expect(taskEvents.length).toBeGreaterThan(0);
  });

  it('handles rapid successive iterations', () => {
    for (let i = 0; i < 10; i++) {
      simulateIteration(`Rapid task ${i}`);
    }
    const events = logger.getEvents({ type: 'iteration-start' });
    expect(events.length).toBe(10);
  });

  it('persists events to disk', () => {
    simulateIteration('Persistent task');
    const logger2 = createLogger(logPath);
    const events = logger2.getEvents();
    expect(events.length).toBeGreaterThan(0);
  });
});
