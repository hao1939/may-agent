type TaskNode = {
  id?: string;
  kind?: string;
  state?: string;
  status?: string;
  context?: unknown;
};

type TaskTree = {
  tasks?: Record<string, TaskNode>;
};

export type FocusMetadataIssue = {
  ownerTaskId: string;
  field: string;
  referencedTaskId: string;
  expectedState: string;
  actualState: string;
  reason: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
    : [];
}

function taskState(task: TaskNode | undefined): string {
  const raw = task?.state ?? task?.status ?? "";
  if (raw === "accepted") return "done";
  if (raw === "ready" || raw === "proposed") return "backlog";
  if (raw === "superseded" || raw === "cancelled") return "done";
  if (raw === "decomposed") return "backlog";
  if (raw === "claimed_done" || raw === "rejected") return "review";
  return typeof raw === "string" ? raw : "";
}

function uniqueIssues(issues: FocusMetadataIssue[]): FocusMetadataIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = [
      issue.ownerTaskId,
      issue.field,
      issue.referencedTaskId,
      issue.expectedState,
      issue.actualState,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractLiveOwnerReturnSetTaskIds(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) return [];

  const patterns = [
    /current live owner-return blocked-holder set is\s+([^.;]+(?:,[^.;]+)*)/i,
    /live owner-return holder set is now\s+([^.;]+(?:,[^.;]+)*)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;
    return match[1]
      .replace(/\s+,?\s+and\s+/g, ", ")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => /[A-Za-z0-9][A-Za-z0-9._/-]*/.test(value))
      .filter((value) => !value.startsWith("The "));
  }

  return [];
}

function pushStructuredIssues(input: {
  issues: FocusMetadataIssue[];
  tree: TaskTree;
  ownerTaskId: string;
  field: string;
  referencedTaskIds: string[];
  expectedState: string;
}) {
  for (const referencedTaskId of input.referencedTaskIds) {
    const actualState = taskState(input.tree.tasks?.[referencedTaskId]);
    if (!actualState) {
      input.issues.push({
        ownerTaskId: input.ownerTaskId,
        field: input.field,
        referencedTaskId,
        expectedState: input.expectedState,
        actualState: "missing",
        reason: `${input.field} references missing task ${referencedTaskId}.`,
      });
      continue;
    }
    if (actualState !== input.expectedState) {
      input.issues.push({
        ownerTaskId: input.ownerTaskId,
        field: input.field,
        referencedTaskId,
        expectedState: input.expectedState,
        actualState,
        reason: `${input.field} references ${referencedTaskId} as ${input.expectedState}, but the live tree state is ${actualState}.`,
      });
    }
  }
}

function pushOwnerReturnTextIssues(input: {
  issues: FocusMetadataIssue[];
  tree: TaskTree;
  ownerTaskId: string;
  field: string;
  text: string;
}) {
  for (const referencedTaskId of extractLiveOwnerReturnSetTaskIds(input.text)) {
    const actualState = taskState(input.tree.tasks?.[referencedTaskId]);
    if (actualState === "blocked") continue;
    input.issues.push({
      ownerTaskId: input.ownerTaskId,
      field: input.field,
      referencedTaskId,
      expectedState: "blocked",
      actualState: actualState || "missing",
      reason:
        actualState === ""
          ? `${input.field} still claims ${referencedTaskId} is in the current live owner-return holder set, but that task is missing from the live tree.`
          : `${input.field} still claims ${referencedTaskId} is in the current live owner-return holder set, but the live tree state is ${actualState}.`,
    });
  }
}

export function auditFocusMetadataIssues(tree: TaskTree): FocusMetadataIssue[] {
  const issues: FocusMetadataIssue[] = [];
  const tasks = tree.tasks ?? {};

  for (const [taskId, task] of Object.entries(tasks)) {
    if (task.kind !== "focus_plan") continue;
    const context = asRecord(task.context);
    const observations = asRecord(context.observations);
    pushStructuredIssues({
      issues,
      tree,
      ownerTaskId: taskId,
      field: "context.observations.linked_active_task_ids",
      referencedTaskIds: asStringArray(observations.linked_active_task_ids),
      expectedState: "active",
    });
    pushStructuredIssues({
      issues,
      tree,
      ownerTaskId: taskId,
      field: "context.observations.linked_review_task_ids",
      referencedTaskIds: asStringArray(observations.linked_review_task_ids),
      expectedState: "review",
    });
    pushStructuredIssues({
      issues,
      tree,
      ownerTaskId: taskId,
      field: "context.observations.linked_blocked_task_ids",
      referencedTaskIds: asStringArray(observations.linked_blocked_task_ids),
      expectedState: "blocked",
    });

    const progressReview = asRecord(context.progress_review);
    for (const [index, value] of asStringArray(progressReview.evidence).entries()) {
      pushOwnerReturnTextIssues({
        issues,
        tree,
        ownerTaskId: taskId,
        field: `context.progress_review.evidence[${index}]`,
        text: value,
      });
    }
  }

  const projectTask = tasks.project;
  const projectContext = asRecord(projectTask?.context);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  pushOwnerReturnTextIssues({
    issues,
    tree,
    ownerTaskId: "project",
    field: "context.current_focus_proposal.reason",
    text: asString(currentFocusProposal.reason),
  });

  return uniqueIssues(issues);
}
