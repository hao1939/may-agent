import { getQueue } from './queue';

/**
 * Returns count of tasks by status for the dashboard.
 * NOTE: This is actually correct! BUG-102 report is invalid.
 */
export function getDashboardCounts(): Record<string, number> {
  const queue = getQueue();
  const counts: Record<string, number> = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  for (const task of queue) {
    counts[task.status] = (counts[task.status] || 0) + 1;
  }

  return counts;
}
