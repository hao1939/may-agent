import { ExecutionDeferredError } from "@may-agent/sdk";
import { isDeepStrictEqual } from "node:util";
import type { SqliteDb } from "../../../lib/db.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import type { AppTaskResourceMutation } from "./app-task-resource-store.js";
import type { TaskTree } from "../tasks/app-task-store.js";
import type { AppTaskResource } from "../tasks/app-task-state.js";
import { matchesTaskCoordination, type TaskCoordinationPolicy } from "../tasks/task-coordination-policy.js";
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
  /** Exact installed coordination declaration and its separate protected grant. */
  coordination?: TaskCoordinationPolicy & { agent: string; dailyCredits: number; credits: number };
};
/** Host-private installation command. It changes the current UTC grant and
 * future daily default together, without changing root caps or past grants. */
export type DailyTaskBudgetFundingChange = {
  changeId: string;
  expected: InstalledTaskBudgetPolicy;
  dailyCredits: number;
  reason: string;
};
export type DailyTaskBudgetFundingReceipt = {
  change: DailyTaskBudgetFundingChange;
  period: string;
  changedAt: number;
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
export class TaskBudgetDeferredError extends ExecutionDeferredError {
  constructor(readonly constraint: TaskFundingConstraint) {
    super({
      resource: "task-credit",
      reason: constraint.reason,
      retryAt: constraint.retryAt,
      task: constraint.task,
      root: constraint.root,
    });
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
    const coordination = policy.coordination;
    if (
      coordination &&
      ([coordination.taskId, coordination.workflow, coordination.agent].some(
        (value) => typeof value !== "string" || !value || value !== value.trim() || Buffer.byteLength(value) > 1024,
      ) ||
        !Number.isSafeInteger(coordination.maxAttemptMs) ||
        coordination.maxAttemptMs < 1_000 || coordination.maxAttemptMs > 120_000)
    )
      throw new Error("Protected funding requires exact bounded coordination eligibility");
    const values = [
      policy.dailyCredits, policy.rootCredits, ...(policy.standing ?? []).map((item) => item.credits),
      ...(coordination ? [coordination.dailyCredits, coordination.credits] : []),
    ];
    if (values.some((value) => !Number.isSafeInteger(value) || value < 0))
      throw new Error("Invalid installed credit allowance");
    const tasks = policy.standing?.map((item) => item.taskId) ?? [];
    if (
      tasks.length > 128 ||
      tasks.some((id) => !id || id !== id.trim() || Buffer.byteLength(id) > 1024) ||
      new Set(tasks).size !== tasks.length ||
      (coordination && tasks.includes(coordination.taskId))
    )
      throw new Error("Standing allowances require unique exact Task identities");
    stateTransaction(this.db, () => {
      const previous = this.policy(policy.appId);
      if (previous && !isDeepStrictEqual(previous, policy))
        throw new Error("Installed budget changes require an explicit funding operation");
      if (!previous) {
        this.db
          .prepare("INSERT INTO task_budget_policies(app_id, policy_json) VALUES (?, ?)")
          .run(policy.appId, JSON.stringify(policy));
        const now = Date.now();
        this.db.prepare(`UPDATE app_inbox_items
          SET handling = NULL, available_at = ?, changed_at = ?, updated_at = ?
          WHERE status != 'done' AND json_extract(handling, '$.phase') = 'deferred'
            AND json_extract(handling, '$.funding.reason') = 'sponsor-policy'
            AND COALESCE(json_extract(handling, '$.funding.policyAppId'),
              json_extract(handling, '$.funding.task.appId')) = ?`)
          .run(now, now, now, policy.appId);
      }
    });
  }

  policy(appId: string): InstalledTaskBudgetPolicy | null {
    const row = this.db.prepare("SELECT policy_json FROM task_budget_policies WHERE app_id = ?").get(appId);
    return row ? (JSON.parse(row.policy_json as string) as InstalledTaskBudgetPolicy) : null;
  }

  /** Loaded App source must agree with installation authority before dispatch. */
  assertCoordinationPolicy(appId: string, agent: string, declared: TaskCoordinationPolicy | undefined): void {
    const installed = this.policy(appId)?.coordination;
    if (!installed) return;
    const { agent: owner, dailyCredits: _dailyCredits, credits: _credits, ...eligibility } = installed;
    if (agent !== owner || !isDeepStrictEqual(eligibility, declared))
      throw new Error("Protected funding differs from the installed App coordination declaration");
  }

  /** Recheck the current resource and actual attempt owner under start admission. */
  assertProtectedTask(task: BudgetTaskRef, resource: AppTaskResource, agent: string, handler?: string): void {
    const policy = this.policy(task.appId);
    const rootRef = this.budget.binding(task);
    const root = rootRef ? this.budget.root(rootRef) : null;
    if (
      !policy?.coordination || !root || !isDeepStrictEqual(root.root, task) ||
      root.purpose !== "coordination" || root.renewal !== "utc-day" ||
      !isDeepStrictEqual(root.sponsor, policy.sponsor) ||
      (handler !== undefined && handler !== `workflow:${policy.coordination.workflow}`) ||
      !matchesTaskCoordination(task.appId, policy.coordination.agent, policy.coordination, resource, agent)
    )
      this.defer(task, "protected-policy", rootRef);
  }

  setDailyCredits(
    input: DailyTaskBudgetFundingChange,
    now: number,
  ): {
    receipt: DailyTaskBudgetFundingReceipt;
    replay: boolean;
  } {
    if (
      [input.changeId, input.reason].some(
        (value) =>
          typeof value !== "string" ||
          !value ||
          value !== value.trim() ||
          Buffer.byteLength(value) > 1024,
      )
    )
      throw new Error(
        "Daily funding requires exact command identity and reason",
      );
    if (!Number.isSafeInteger(input.dailyCredits) || input.dailyCredits < 0)
      throw new Error("Daily credits must be a non-negative safe integer");
    const period = utcBudgetPeriod(now);
    return stateTransaction(this.db, () => {
      const saved = this.db
        .prepare(
          "SELECT receipt_json FROM task_budget_policy_funding_receipts WHERE change_id = ?",
        )
        .get(input.changeId);
      if (saved) {
        const receipt = JSON.parse(
          saved.receipt_json as string,
        ) as DailyTaskBudgetFundingReceipt;
        if (!isDeepStrictEqual(receipt.change, input))
          throw new Error(
            "Daily funding identity was reused for a different command",
          );
        return { receipt, replay: true };
      }
      const current = this.policy(input.expected.appId);
      if (!current || !isDeepStrictEqual(current, input.expected))
        throw new Error(
          "Daily funding requires the exact current installed policy",
        );
      const grant = this.db
        .prepare(
          `SELECT credits, charged FROM task_credit_grants
        WHERE sponsor_app_id = ? AND sponsor_agent = ? AND purpose = 'ordinary' AND period = ?`,
        )
        .get(current.sponsor.appId, current.sponsor.agent, period);
      if (grant && grant.credits !== current.dailyCredits)
        throw new Error(
          "Current grant differs from its installed daily policy",
        );
      if (input.dailyCredits < ((grant?.charged as number | undefined) ?? 0))
        throw new Error(
          "Daily allowance cannot be lower than its charged credits",
        );
      const receipt: DailyTaskBudgetFundingReceipt = {
        change: structuredClone(input),
        period,
        changedAt: now,
      };
      this.db
        .prepare(
          "UPDATE task_budget_policies SET policy_json = ? WHERE app_id = ?",
        )
        .run(
          JSON.stringify({ ...current, dailyCredits: input.dailyCredits }),
          current.appId,
        );
      this.db
        .prepare(
          `INSERT INTO task_credit_grants(sponsor_app_id, sponsor_agent, purpose, period, credits)
        VALUES (?, ?, 'ordinary', ?, ?)
        ON CONFLICT(sponsor_app_id, sponsor_agent, purpose, period) DO UPDATE SET credits = excluded.credits`,
        )
        .run(
          current.sponsor.appId,
          current.sponsor.agent,
          period,
          input.dailyCredits,
        );
      this.db
        .prepare(
          `INSERT INTO task_budget_policy_funding_receipts(change_id, policy_app_id, changed_at, receipt_json)
        VALUES (?, ?, ?, ?)`,
        )
        .run(input.changeId, current.appId, now, JSON.stringify(receipt));
      return { receipt, replay: false };
    });
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
    if (
      policy && isDeepStrictEqual(root.sponsor, policy.sponsor) &&
      (root.purpose === "ordinary" ||
        (policy.coordination && root.root.appId === policy.appId && root.root.taskId === policy.coordination.taskId))
    )
      this.budget.grant({
        sponsor: root.sponsor,
        purpose: root.purpose,
        period: utcBudgetPeriod(now),
        credits: root.purpose === "ordinary" ? policy.dailyCredits : policy.coordination!.dailyCredits,
      });
  }

  /** Called by common managed-start admission, after validating the live actor. */
  admitHelper(task: BudgetTaskRef, invocationId: string, now: number): string {
    const rootRef = this.budget.binding(task);
    if (!rootRef) this.defer(task, "adoption-required", task);
    const root = this.budget.root(rootRef)!;
    // Managed admission already rechecked the exact protected Task and live actor.
    this.renew(root, now);
    const charged = this.budget.charge({ task, kind: "helper", invocationId }, now);
    if (charged.kind === "deferred")
      throw new TaskBudgetDeferredError({ ...charged, sponsor: root.sponsor, purpose: root.purpose });
    return charged.receipt.operationId;
  }

  /** Recheck under the transaction that records a hold, avoiding lost funding
   * or adoption wakes between a rolled-back admission and its saved constraint. */
  stillConstrained(
    constraint: TaskFundingConstraint,
    now = Date.now(),
    current?: { resource: AppTaskResource; agent: string },
  ): boolean {
    if (constraint.reason === "protected-policy" && current &&
      current.resource.metadata.id === constraint.task.taskId) {
      try {
        this.assertProtectedTask(constraint.task, current.resource, current.agent);
        return false;
      } catch (error) {
        if (!(error instanceof TaskBudgetDeferredError)) throw error;
        return true;
      }
    }
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
    const destinationPolicy = this.policy(appId);
    // Unconfigured installations preserve their existing behavior. A funded
    // creator still carries its account into an unconfigured destination App.
    if (!policy && !destinationPolicy && !creatorRoot && !this.budget.binding(task)) return;
    if (destinationPolicy?.coordination?.taskId === task.taskId && (creator.appId !== appId || creatorTask))
      this.defer(task, "protected-policy", task);
    if (creatorTask) {
      if (!creatorRoot) this.defer(task, "adoption-required", creatorTask);
      if (this.budget.root(creatorRoot)!.purpose !== "ordinary")
        this.defer(task, "protected-contribution", creatorRoot);
      this.budget.bind(task, creatorRoot);
    } else if (!this.budget.binding(task)) {
      if (!policy) this.defer(task, "sponsor-policy", null, creator.appId);
      const coordination =
        appId === policy.appId && policy.coordination?.taskId === task.taskId ? policy.coordination : undefined;
      if (
        coordination && !matchesTaskCoordination(appId, coordination.agent, coordination, resource,
          resource.spec.agent ?? resource.spec.owner ?? coordination.agent)
      )
        this.defer(task, "protected-policy", task);
      const standing = policy.standing?.find((item) => item.taskId === task.taskId);
      this.budget.registerRoot({
        root: task,
        sponsor: policy.sponsor,
        purpose: coordination ? "coordination" : "ordinary",
        credits: coordination?.credits ?? standing?.credits ?? policy.rootCredits,
        renewal: coordination || standing ? "utc-day" : "lifetime",
      });
    }
    const root = this.budget.root(this.budget.binding(task)!)!;
    if (root.purpose !== "ordinary") {
      if (creatorTask) this.defer(task, "protected-contribution", root.root);
      this.assertProtectedTask(task, resource, resource.spec.agent ?? resource.spec.owner ?? policy?.coordination?.agent ?? "");
    }
    this.renew(root, now);
    const charged = this.budget.charge({ task, kind: "task" }, now);
    if (charged.kind === "deferred")
      throw new TaskBudgetDeferredError({ ...charged, sponsor: root.sponsor, purpose: root.purpose });
  }

  /** New authored seeds are App-created work. Retained snapshots use explicit
   * historical adoption instead; no unknown past cost or creator is invented. */
  admitNewSeed(appId: string, tree: TaskTree, now = Date.now()): void {
    const resources = Object.values(tree.resources ?? {});
    const relevant =
      this.policy(appId) ||
      resources.some((resource) => {
        const creator = resource.metadata.creator;
        return (
          this.budget.binding({ appId, taskId: resource.metadata.id }) ||
          (creator &&
            (this.policy(creator.appId) ||
              (creator.taskId && this.budget.binding({ appId: creator.appId, taskId: creator.taskId }))))
        );
      });
    if (!relevant) return;
    if (
      Object.keys(tree.attempts ?? {}).length ||
      Object.keys(tree.receipts ?? {}).length ||
      Object.keys(tree.cancellations ?? {}).length ||
      resources.some(
        (resource) =>
          resource.metadata.generation !== 1 ||
          resource.metadata.resourceVersion !== 1 ||
          resource.status.phase !== "pending" ||
          resource.status.observedGeneration !== 0 ||
          resource.status.currentAttemptId ||
          resource.status.observedAttemptId ||
          resource.status.workspaceAttemptId,
      )
    )
      throw new Error(
        "Budgeted seed contains execution history; restore retained facts and explicitly adopt future work",
      );
    for (const resource of resources) {
      if (resource.metadata.creator && !isDeepStrictEqual(resource.metadata.creator, { appId }))
        throw new Error(
          "A new budgeted seed requires its exact App-only creator; contribution admission needs its creating Task",
        );
      resource.metadata.creator = { appId };
    }
    this.admitMutation(
      appId,
      { fences: [], tasks: resources.map((resource) => ({ resource, ready: false })) },
      new Set(),
      now,
    );
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
      if (root.purpose !== "ordinary") this.assertProtectedTask(task, write, attempt.owner, attempt.handler);
      this.renew(root, now);
      const charged = this.budget.charge({ task, kind: "attempt", attemptId: attempt.metadata.id }, now);
      if (charged.kind === "deferred")
        throw new TaskBudgetDeferredError({ ...charged, sponsor: root.sponsor, purpose: root.purpose });
    }
  }
}
