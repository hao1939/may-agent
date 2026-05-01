import { getQueue } from './queue';

/**
 * Cleanup job: removes completed tasks older than 1 hour to prevent disk filling.
 * Runs every 5 minutes via cron.
 */
export function cleanupOldTasks(): number {
  const queue = getQueue();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  let cleaned = 0;

  // BUG-105: Filtering by wrong status field — checks 'processing' instead of 'completed'
  // This means completed tasks are NEVER cleaned up, causing disk to fill
  const toClean = queue.filter(t => 
    t.status === 'processing' && t.completedAt && t.completedAt < oneHourAgo
  );

  // In real implementation, this would delete from persistent storage
  for (const task of toClean) {
    console.log(`Cleaning task ${task.id}`);
    cleaned++;
  }

  return cleaned;
}
