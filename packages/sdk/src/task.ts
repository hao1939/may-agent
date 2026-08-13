export type TaskMode = "achieve" | "maintain";
export type TaskPriority = "P0" | "P1" | "P2" | "P3";

/** Desired durable outcome handed to the task reconciler. */
export type TaskIntent = {
  id: string;
  parentId: string;
  outcome: string;
  acceptance: string[];
  mode: TaskMode;
  owner?: string;
  workflow?: string;
  input?: Record<string, unknown>;
  outputs?: string[];
  dependsOn?: string[];
  priority?: TaskPriority;
  category?: string;
};

/** Exact observable fact that can wake durable work. */
export type Condition = {
  id: string;
  type: string;
  subject: string;
  expected: unknown;
  owner?: string;
  reviewAfterMs?: number;
};
