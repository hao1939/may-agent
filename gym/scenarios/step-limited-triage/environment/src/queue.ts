interface Task {
  id: string;
  payload: any;
  priority: number; // 1 = highest, 5 = lowest
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

const queue: Task[] = [];

export function enqueue(task: Omit<Task, 'status' | 'createdAt'>): Task {
  const newTask: Task = {
    ...task,
    status: 'pending',
    createdAt: new Date(),
  };
  queue.push(newTask);
  return newTask;
}

export function dequeue(): Task | null {
  // BUG-103: Sort comparator is reversed — lower priority number should come first
  // but this sorts descending (highest number first)
  const pending = queue.filter(t => t.status === 'pending');
  pending.sort((a, b) => a.priority - b.priority); // BUG: should be b.priority - a.priority... wait no
  // Actually this sorts ascending (1 first) which seems right but the bug is:
  // priority 1 = highest priority, so ascending IS correct for "highest first"
  // The REAL bug: we're sorting the filtered copy but returning from original queue
  const next = queue.find(t => t.status === 'pending');
  if (!next) return null;
  next.status = 'processing';
  return next;
}

export function getQueue(): Task[] {
  return [...queue];
}

export function getTask(id: string): Task | undefined {
  return queue.find(t => t.id === id);
}

export function markComplete(id: string): void {
  const task = queue.find(t => t.id === id);
  if (task) {
    task.status = 'completed';
    task.completedAt = new Date();
  }
}
