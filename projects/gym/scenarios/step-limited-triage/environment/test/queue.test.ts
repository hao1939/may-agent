import { enqueue, dequeue, getQueue, markComplete } from '../src/queue';

// Basic tests — these pass but don't cover the bugs
describe('Queue', () => {
  test('enqueue adds task', () => {
    const task = enqueue({ id: 'test-1', payload: { action: 'send-email' }, priority: 3 });
    expect(task.status).toBe('pending');
    expect(task.id).toBe('test-1');
  });

  test('dequeue returns a task', () => {
    enqueue({ id: 'test-2', payload: { action: 'process' }, priority: 1 });
    enqueue({ id: 'test-3', payload: { action: 'notify' }, priority: 5 });
    const task = dequeue();
    expect(task).not.toBeNull();
    expect(task!.status).toBe('processing');
  });

  test('markComplete updates status', () => {
    enqueue({ id: 'test-4', payload: { action: 'cleanup' }, priority: 2 });
    const task = dequeue();
    markComplete(task!.id);
    const updated = getQueue().find(t => t.id === task!.id);
    expect(updated!.status).toBe('completed');
  });
});
