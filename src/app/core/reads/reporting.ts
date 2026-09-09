import type { TaskDetail, TaskListOptions, TaskOutcomePage, TaskOutcomeProjection, TaskPage } from "@may-agent/sdk";

/** Optional read-only report over canonical Task reads. No private store access. */
export type TaskOutcomeReader = (input: {
  appDir: string;
  tasks: {
    list(options?: TaskListOptions): TaskPage;
    get(taskId: string): TaskDetail | null;
  };
  projection?: TaskOutcomeProjection;
}) => TaskOutcomePage;
