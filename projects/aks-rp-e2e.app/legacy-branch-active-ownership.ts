export type LegacyOwnershipTask = {
  category?: string;
  phase?: string;
  state?: string;
  resource_version?: number;
  resourceVersion?: number;
  input?: Record<string, unknown>;
  outputs?: string[];
};

export type ActiveDomainPathOwner = {
  taskId: string;
  phase: string;
  resourceVersion: number;
  paths: string[];
};

const activePhases = new Set(["pending", "running", "waiting", "attention"]);

function normalizedPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim().replace(/^\.\//, "");
  return path || null;
}

function ownedPaths(task: LegacyOwnershipTask): string[] {
  const input = task.input ?? {};
  return [
    input.workKey,
    input.scenarioTestPath,
    input.adapterPath,
    ...(Array.isArray(task.outputs) ? task.outputs : []),
  ].flatMap((value) => {
    const path = normalizedPath(value);
    return path ? [path] : [];
  });
}

/**
 * Find live domain tasks that already own an exact file touched by a legacy
 * branch. Exact paths keep this mechanical guard from becoming a broad
 * feature-level lock.
 */
export function activeDomainPathOwners(
  tasks: Record<string, LegacyOwnershipTask>,
  changedFiles: readonly string[],
): ActiveDomainPathOwner[] {
  const files = new Set(
    changedFiles.flatMap((value) => {
      const path = normalizedPath(value);
      return path ? [path] : [];
    }),
  );
  if (!files.size) return [];

  return Object.entries(tasks).flatMap(([taskId, task]) => {
    const phase = task.phase ?? task.state ?? "";
    const domainTask =
      task.category === "domain_leaf" || taskId.startsWith("domain/");
    if (!domainTask || !activePhases.has(phase)) return [];
    const paths = [
      ...new Set(ownedPaths(task).filter((path) => files.has(path))),
    ];
    if (!paths.length) return [];
    return [
      {
        taskId,
        phase,
        resourceVersion: Number(
          task.resource_version ?? task.resourceVersion ?? 0,
        ),
        paths,
      },
    ];
  });
}
