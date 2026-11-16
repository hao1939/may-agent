/**
 * scheduler.js — Task Scheduler
 * 
 * Schedules and manages recurring tasks with date formatting.
 */

const { formatDate, parseDuration } = require('./utils');

const tasks = [];

function scheduleTask(name, intervalStr, callback) {
  const intervalMs = parseDuration(intervalStr);
  const task = {
    id: `TASK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    intervalMs,
    callback,
    createdAt: new Date(),
    lastRun: null,
    nextRun: new Date(Date.now() + intervalMs),
    runCount: 0,
    status: 'active'
  };
  tasks.push(task);
  return task;
}

function runDueTasks() {
  const now = new Date();
  const results = [];

  for (const task of tasks) {
    if (task.status !== 'active') continue;
    if (now >= task.nextRun) {
      try {
        const result = task.callback();
        task.lastRun = now;
        task.nextRun = new Date(now.getTime() + task.intervalMs);
        task.runCount++;
        results.push({
          taskId: task.id,
          name: task.name,
          ranAt: formatDate(now, 'iso'),
          displayTime: formatDate(now, 'full'),
          nextRun: formatDate(task.nextRun, 'full'),
          result
        });
      } catch (err) {
        results.push({
          taskId: task.id,
          name: task.name,
          ranAt: formatDate(now, 'iso'),
          error: err.message
        });
      }
    }
  }
  return results;
}

function getTaskStatus() {
  return tasks.map(t => ({
    id: t.id,
    name: t.name,
    status: t.status,
    runCount: t.runCount,
    lastRun: t.lastRun ? formatDate(t.lastRun, 'relative') : 'never',
    nextRun: formatDate(t.nextRun, 'full'),
    created: formatDate(t.createdAt, 'short')
  }));
}

function cancelTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.status = 'cancelled';
    task.cancelledAt = formatDate(new Date(), 'iso');
  }
  return task;
}

module.exports = {
  scheduleTask,
  runDueTasks,
  getTaskStatus,
  cancelTask
};
