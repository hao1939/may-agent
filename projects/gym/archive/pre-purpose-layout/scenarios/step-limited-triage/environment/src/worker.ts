import { dequeue, markComplete, getTask } from './queue';

const processedIds = new Set<string>();

export async function processNext(): Promise<void> {
  const task = dequeue();
  if (!task) return;

  // BUG-101: No idempotency check — if task is somehow dequeued twice
  // (e.g., race condition with concurrent workers), it executes twice.
  // Missing: if (processedIds.has(task.id)) return;
  
  try {
    if (!task.payload) {
      // BUG-104: crashes on empty payload instead of graceful handling
      throw new Error(`Empty payload for task ${task.id}`);
    }
    
    await executeTask(task.payload);
    markComplete(task.id);
  } catch (err) {
    console.error(`Task ${task.id} failed:`, err);
    // Note: doesn't mark as failed, leaving it in 'processing' limbo
  }
}

async function executeTask(payload: any): Promise<void> {
  // Simulate work
  await new Promise(resolve => setTimeout(resolve, 10));
  console.log(`Executed: ${JSON.stringify(payload)}`);
}

export function startWorker(intervalMs = 1000): NodeJS.Timer {
  return setInterval(processNext, intervalMs);
}
