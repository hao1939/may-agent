import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { AppDefinition } from "@may-agent/sdk";
import { getDb } from "../../../lib/db/connection.js";
import type { AppRegistry, AppRegistrySnapshot } from "../apps/registry.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { loadProjectReadModel, projectRuntimePaths } from "./app-task-runtime-state.js";
import type { TaskTree } from "./app-task-store.js";

// Prepare Task definitions and their existing resource/read-model bindings.
// Controller publication, rollback and execution remain in app-task-runtime.ts.

export interface AppTaskRuntimeDescriptor {
  id: string;
  appDir: string;
  projectDir: string;
  agent: string;
  app: AppDefinition;
  reconciliationPaused: boolean;
  /** Canonical Task authority; descriptor construction refuses legacy JSON state. */
  resourceStore: AppTaskResourceStore;
}

type ProjectReadModel = {
  id: string;
  path: string;
  name: string;
  owner: string;
  status: string;
  type: string;
  priority: string | null;
};

export function configuredAppAgent(app: AppDefinition, appDir: string): string {
  const agent = typeof app.agent === "string" ? app.agent.trim() : "";
  if (agent) return agent.replace(/^agent:/, "");
  const legacyOwner = typeof app.owner === "string" ? app.owner.trim() : "";
  if (legacyOwner) return legacyOwner.replace(/^agent:/, "");
  // Registry validation requires an explicit agent. Never infer authority by
  // scanning agent files here, including for standalone admission descriptors.
  throw new Error(`App ${appDir} must declare its agent`);
}

function domainProjectDir(projectsRoot: string, appDir: string, appId: string, app: AppDefinition): string {
  const localPath = typeof app.workspace?.localPath === "string" ? app.workspace.localPath.trim() : "";
  if (localPath) return resolve(appDir, localPath);
  const sibling = resolve(projectsRoot, appId);
  return existsSync(sibling) ? sibling : appDir;
}

function projectReadModel(projectRoot: string, descriptor: AppTaskRuntimeDescriptor): ProjectReadModel {
  const projectJson = loadProjectReadModel(descriptor.appDir);
  const id = typeof projectJson.id === "string" && projectJson.id.trim() ? projectJson.id.trim() : descriptor.id;
  const owner =
    typeof projectJson.owner === "string" && projectJson.owner.trim()
      ? projectJson.owner.trim().replace(/^agent:/, "")
      : descriptor.agent;
  const status =
    typeof projectJson.status === "string" && projectJson.status.trim() ? projectJson.status.trim() : "active";
  const type = typeof projectJson.type === "string" && projectJson.type.trim() ? projectJson.type.trim() : "agent-app";
  const priority =
    typeof projectJson.priority === "string" && projectJson.priority.trim() ? projectJson.priority.trim() : null;
  const relativePath = relative(projectRoot, descriptor.appDir).replace(/\\/g, "/");
  return {
    id,
    path: relativePath && !relativePath.startsWith("..") ? relativePath : descriptor.appDir,
    name: id,
    owner,
    status,
    type,
    priority,
  };
}

export function syncProjectReadModel(
  opts: { persistDir?: string; projectRoot: string },
  descriptor: AppTaskRuntimeDescriptor,
): void {
  if (!opts.persistDir) return;
  const model = projectReadModel(opts.projectRoot, descriptor);
  const db = getDb(opts.persistDir);
  db.run(
    `INSERT INTO projects (id, path, name, owner, status, type, workflow, priority, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       path = excluded.path,
       name = excluded.name,
       owner = excluded.owner,
       status = excluded.status,
       type = excluded.type,
       workflow = excluded.workflow,
       priority = COALESCE(excluded.priority, projects.priority),
       updated_at = excluded.updated_at`,
    [model.id, model.path, model.name, model.owner, model.status, model.type, "", model.priority, Date.now()],
  );
}

function validatePreparedAppTaskRuntime(descriptor: AppTaskRuntimeDescriptor): void {
  const { app, id } = descriptor;
  const concurrency = app.tasks?.maxConcurrent ?? 1;
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error(`App ${id} task maxConcurrent must be a positive integer`);
  }
  descriptor.resourceStore.assertCompletionReceiptsImported();
}

function discoverAppTaskResourceStore(
  persistDir: string | undefined,
  app: AppDefinition,
  appDir: string,
): AppTaskResourceStore {
  const appId = app.id;
  if (!persistDir) throw new Error(`App ${appId} task runtime requires the Host persistence directory`);
  const db = getDb(persistDir);
  const active = AppTaskResourceStore.activeFromDb(db, appId);
  if (active) return active;
  if (existsSync(projectRuntimePaths(appDir).taskStatePath)) {
    throw new Error(
      `App ${appId} has unsupported historical JSON task state but no active resource authority; inspect that facts outside the Host or restore the canonical resource database`,
    );
  }

  const seedPath = join(appDir, "tasks", "seed.json");
  const seedText = existsSync(seedPath) ? readFileSync(seedPath, "utf8") : "{}";
  const parsed = JSON.parse(seedText) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`App ${appId} task seed must be a JSON object`);
  }
  const seed = parsed as Record<string, unknown>;
  const tree = {
    ...seed,
    project: typeof seed.project === "string" && seed.project.trim() ? seed.project : appId,
    project_lifecycle: seed.project_lifecycle === "paused" ? "paused" : "active",
    groups: seed.groups && typeof seed.groups === "object" && !Array.isArray(seed.groups) ? seed.groups : {},
    resources:
      seed.resources && typeof seed.resources === "object" && !Array.isArray(seed.resources) ? seed.resources : {},
    tasks: {},
  } as TaskTree;
  // A Conversation-only App needs no authored Task tree. Keep the structural
  // root conventional; it is neither work nor another execution identity.
  if (app.conversation && Object.keys(tree.groups ?? {}).length === 0) {
    tree.root_task_id = "root";
    tree.groups = { root: { id: "root", parent_id: null } };
  }
  const sourceRevision = `seed:${createHash("sha256").update(seedText).digest("hex")}`;
  const store = AppTaskResourceStore.fromDb(db, appId);
  store.bootstrapSnapshot(tree, sourceRevision);
  const bootstrapped = AppTaskResourceStore.activeFromDb(db, appId);
  if (!bootstrapped) throw new Error(`App ${appId} task resource bootstrap did not publish authority`);
  return bootstrapped;
}

export async function prepareAppTaskRuntimeDescriptors(opts: {
  projectsRoot: string;
  persistDir?: string;
  taskAppIds?: readonly string[];
  appRegistry?: AppRegistry;
  appRegistrySnapshot?: AppRegistrySnapshot;
}): Promise<AppTaskRuntimeDescriptor[]> {
  const descriptors: AppTaskRuntimeDescriptor[] = [];
  const ids = new Set<string>();
  const selectedIds = opts.taskAppIds ? new Set(opts.taskAppIds.map((id) => id.trim().replace(/\.app$/, ""))) : null;
  const entries = opts.appRegistrySnapshot?.entries ?? opts.appRegistry?.snapshot().entries ?? [];
  for (const { appDir, definition: app } of entries) {
    if (!app.tasks && !app.conversation) continue;
    const id = app.id;
    if (selectedIds && !selectedIds.has(id)) continue;
    if (ids.has(id)) throw new Error(`Duplicate App task runtime id: ${id}`);
    ids.add(id);
    const resourceStore = discoverAppTaskResourceStore(opts.persistDir, app, appDir);
    const descriptor: AppTaskRuntimeDescriptor = {
      id,
      appDir,
      projectDir: domainProjectDir(opts.projectsRoot, appDir, id, app),
      agent: configuredAppAgent(app, appDir),
      app,
      reconciliationPaused: false,
      resourceStore,
    };
    descriptor.reconciliationPaused = resourceStore.projectLifecycle() === "paused";
    validatePreparedAppTaskRuntime(descriptor);
    resourceStore.setConfiguredMaxConcurrent(app.tasks?.maxConcurrent ?? 1);
    descriptors.push(descriptor);
  }
  return descriptors;
}

export function standaloneAppTaskAdmissionDescriptors(input: {
  persistDir: string;
  projectsRoot: string;
  entries: AppRegistrySnapshot["entries"];
}): Map<string, AppTaskRuntimeDescriptor> {
  const descriptors = new Map<string, AppTaskRuntimeDescriptor>();
  for (const { appDir, definition: app } of input.entries) {
    if (!app.tasks) continue;
    const resourceStore = discoverAppTaskResourceStore(input.persistDir, app, appDir);
    const descriptor: AppTaskRuntimeDescriptor = {
      id: app.id,
      appDir,
      projectDir: domainProjectDir(input.projectsRoot, appDir, app.id, app),
      agent: configuredAppAgent(app, appDir),
      app,
      reconciliationPaused: resourceStore.projectLifecycle() === "paused",
      resourceStore,
    };
    validatePreparedAppTaskRuntime(descriptor);
    descriptors.set(descriptor.id, descriptor);
  }
  return descriptors;
}
