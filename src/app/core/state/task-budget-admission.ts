import { isDeepStrictEqual } from "node:util";
import type { SqliteDb } from "../../../lib/db.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import type { AppTaskResourceMutation } from "./app-task-resource-store.js";
import type { AppTaskResource } from "../tasks/app-task-state.js";
import {
  TaskBudgetStore,
  utcBudgetPeriod,
  type BudgetAdmission,
  type BudgetRoot,
  type BudgetSponsor,
  type BudgetPurpose,
  type BudgetTaskRef,
} from "./task-budget-store.js";

/** Host-private installation policy. No input, Task label or executor selects funds.
 * Not exposed for production activation until all start paths support deferral. */
export type InstalledTaskBudgetPolicy = {
  appId: string;
  sponsor: BudgetSponsor;
  dailyCredits: number;
  rootCredits: number;
  /** Exact installed standing assignments; ordinary roots otherwise have lifetime caps. */
  standing?: ReadonlyArray<{ taskId: string; credits: number }>;
};
export type TaskFundingConstraint = (
  | Exclude<BudgetAdmission, { kind: "admitted" }>
  | {
      kind: "deferred";
      reason: "adoption-required" | "sponsor-policy" | "protected-contribution" | "protected-policy";
      task: BudgetTaskRef;
      root: BudgetTaskRef | null;
      retryAt: null;
    }
) & { sponsor?: BudgetSponsor; purpose?: BudgetPurpose; policyAppId?: string };
export class TaskBudgetDeferredError extends Error {
  constructor(readonly constraint: TaskFundingConstraint) {
    super(`Task admission deferred: ${constraint.reason}`);
    this.name = "TaskBudgetDeferredError";
  }
}

/** Budget policy and resource admission use the same installation database. */
export class TaskBudgetAdmissionStore {
  readonly budget: TaskBudgetStore;
  constructor(readonly db: SqliteDb) {
    this.budget = new TaskBudgetStore(db);
  }

  install(policy: InstalledTaskBudgetPolicy): void {
    if (
      !policy.appId ||
      policy.appId !== policy.appId.trim() ||
      policy.appId.endsWith(".app") ||
      Buffer.byteLength(policy.appId) > 1024 ||
      policy.appId !== policy.sponsor.appId ||
      !policy.sponsor.agent ||
      policy.sponsor.agent !== policy.sponsor.agent.trim() ||
      Buffer.byteLength(policy.sponsor.agent) > 1024
    )
      throw new Error("Budget installation requires exact App and sponsor identities");
    const values = [policy.dailyCredits, policy.rootCredits, ...(policy.standing ?? []).map((item) => item.credits)];
    if (values.some((value) => !Number.isSafeInteger(value) || value < 0))
      throw new Error("Invalid installed credit allowance");
    const tasks = policy.standing?.map((item) => item.taskId) ?? [];
    if (
      tasks.length > 128 ||
      tasks.some((id) => !id || id !== id.trim() || Buffer.byteLength(id) > 1024) ||
      new Set(tasks).size !== tasks.length
    )
      throw new Error("Standing allowances require unique exact Task identities");
    stateTransaction(this.db, () => {
      const previous = this.policy(policy.appId);
      if (previous && !isDeepStrictEqual(previous, policy))
        throw new Error("Installed budget changes require an explicit funding operation");
      if (!previous)
        this.db
          .prepare("INSERT INTO task_budget_policies(app_id, policy_json) VALUES (?, ?)")
          .run(policy.appId, JSON.stringify(policy));
    });
  }

  policy(appId: string): InstalledTaskBudgetPolicy | null {
    const row = this.db.prepare("SELECT policy_json FROM task_budget_policies WHERE app_id = ?").get(appId);
    return row ? (JSON.parse(row.policy_json as string) as InstalledTaskBudgetPolicy) : null;
  }

  private defer(
    task: BudgetTaskRef,
    reason: "adoption-required" | "sponsor-policy" | "protected-contribution" | "protected-policy",
    root: BudgetTaskRef | null = null,
    policyAppId?: string,
  ): never {
    throw new TaskBudgetDeferredError({
      kind: "deferred",
      task,
      reason,
      root,
      retryAt: null,
      ...(policyAppId ? { policyAppId } : {}),
    });
  }

  private renew(root: BudgetRoot, now: number): void {
    const policy = this.policy(root.sponsor.appId);
    if (root.purpose === "ordinary" && policy && isDeepStrictEqual(root.sponsor, policy.sponsor))
      this.budget.grant({
        sponsor: root.sponsor,
        purpose: root.purpose,
        period: utcBudgetPeriod(now),
        credits: policy.dailyCredits,
      });
  }

  /** Recheck under the transaction that records a hold, avoiding lost funding
   * or adoption wakes between a rolled-back admission and its saved constraint. */
  stillConstrained(constraint: TaskFundingConstraint, now = Date.now()): boolean {
    if (constraint.reason === "adoption-required") return !this.budget.binding(constraint.root ?? constraint.task);
    if (constraint.reason === "sponsor-policy") return !this.policy(constraint.policyAppId ?? constraint.task.appId);
    if (constraint.reason === "sponsor-credit" && constraint.sponsor && constraint.purpose) {
      const grant = this.db
        .prepare(
          `SELECT credits, charged FROM task_credit_grants
        WHERE sponsor_app_id = ? AND sponsor_agent = ? AND purpose = ? AND period = ?`,
        )
        .get(constraint.sponsor.appId, constraint.sponsor.agent, constraint.purpose, utcBudgetPeriod(now));
      return !grant || (grant.charged as number) >= (grant.credits as number);
    }
    if (constraint.reason === "root-credit" && constraint.root) {
      const root = this.budget.root(constraint.root);
      if (root) return this.budget.view(root.root, now)!.rootCharged >= root.credits;
    }
    return true;
  }

  private creation(appId: string, resource: AppTaskResource, now: number): void {
    const task = { appId, taskId: resource.metadata.id };
    const creator = resource.metadata.creator ?? { appId };
    const creatorTask = creator.taskId ? { appId: creator.appId, taskId: creator.taskId } : null;
    const creatorRoot = creatorTask ? this.budget.binding(creatorTask) : null;
    const policy = this.policy(creator.appId);
    // Unconfigured installations preserve their existing behavior. A funded
    // creator still carries its account into an unconfigured destination App.
    if (!policy && !this.policy(appId) && !creatorRoot && !this.budget.binding(task)) return;
    if (creatorTask) {
      if (!creatorRoot) this.defer(task, "adoption-required", creatorTask);
      if (this.budget.root(creatorRoot)!.purpose !== "ordinary")
        this.defer(task, "protected-contribution", creatorRoot);
      this.budget.bind(task, creatorRoot);
    } else if (!this.budget.binding(task)) {
      if (!policy) this.defer(task, "sponsor-policy", null, creator.appId);
      const standing = policy.standing?.find((item) => item.taskId === task.taskId);
      this.budget.registerRoot({
        root: task,
        sponsor: policy.sponsor,
        purpose: "ordinary",
        credits: standing?.credits ?? policy.rootCredits,
        renewal: standing ? "utc-day" : "lifetime",
      });
    }
    const root = this.budget.root(this.budget.binding(task)!)!;
    if (root.purpose !== "ordinary") this.defer(task, "protected-contribution", root.root);
    this.renew(root, now);
    const charged = this.budget.charge({ task, kind: "task" }, now);
    if (charged.kind === "deferred")
      throw new TaskBudgetDeferredError({ ...charged, sponsor: root.sponsor, purpose: root.purpose });
  }

  /** Invoked only after every resource fence passes, inside its write transaction.
   * This callback creates no lifecycle or scheduler writes of its own. */
  admitMutation(
    appId: string,
    mutation: AppTaskResourceMutation,
    restoredTaskIds: ReadonlySet<string> = new Set(),
    now = Date.now(),
  ): void {
    const absent = new Set(
      (mutation.tasks ?? [])
        .filter(
          ({ resource }) =>
            !this.db
              .prepare("SELECT 1 FROM app_tasks WHERE app_id = ? AND task_id = ?")
              .get(appId, resource.metadata.id),
        )
        .map(({ resource }) => resource.metadata.id),
    );
    for (const { resource } of mutation.tasks ?? [])
      if (absent.has(resource.metadata.id) && !restoredTaskIds.has(resource.metadata.id))
        this.creation(appId, resource, now);
    for (const attempt of mutation.attempts ?? []) {
      if (
        attempt.state !== "running" ||
        this.db
          .prepare("SELECT 1 FROM app_task_attempts WHERE app_id = ? AND attempt_id = ?")
          .get(appId, attempt.metadata.id)
      )
        continue;
      const task = { appId, taskId: attempt.taskId };
      const rootRef = this.budget.binding(task);
      if (!rootRef) {
        if (this.policy(appId)) this.defer(task, "adoption-required", task);
        continue;
      }
      const write = mutation.tasks?.find((entry) => entry.resource.metadata.id === attempt.taskId)?.resource;
      if (
        !write ||
        write.status.currentAttemptId !== attempt.metadata.id ||
        write.metadata.generation !== attempt.taskGeneration
      )
        throw new Error("Budgeted attempt requires its exact resource claim");
      const root = this.budget.root(rootRef)!;
      if (root.purpose !== "ordinary") this.defer(task, "protected-policy", rootRef);
      this.renew(root, now);
      const charged = this.budget.charge({ task, kind: "attempt", attemptId: attempt.metadata.id }, now);
      if (charged.kind === "deferred")
        throw new TaskBudgetDeferredError({ ...charged, sponsor: root.sponsor, purpose: root.purpose });
    }
  }
}
