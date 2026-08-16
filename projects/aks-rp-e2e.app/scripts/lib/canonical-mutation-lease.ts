import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

export type CanonicalLeaseHolder = {
  sessionId: string;
  owner: string;
  taskId: string;
};

export type CanonicalContention = {
  state: "waiting";
  condition: {
    id: string;
    type: "session.state";
    subject: string;
    expected: { field: "status"; notEquals: "running" };
  };
  leaseKey: string;
  projectId: string;
  path: string;
  conflictingSession: string;
  owner: string;
  observer: "canonical-mutation-lease";
  checkMethod: string;
  fallback: string;
  affectedScope: string;
};

export class CanonicalMutationContentionError extends Error {
  constructor(readonly receipt: CanonicalContention) {
    super(JSON.stringify(receipt));
  }
}

export type CanonicalMutationLease = {
  leaseKey: string;
  leaseDir: string;
  mutate<T>(label: string, operation: () => T): T;
  release(): void;
};

type AcquireOptions = {
  projectId: string;
  canonicalPath: string;
  holder: CanonicalLeaseHolder;
  leaseRoot?: string;
  checkpointPath?: string;
  activeSessions?: () => CanonicalLeaseHolder[];
  fingerprint?: () => unknown;
};

function stablePath(path: string): string {
  const absolute = resolve(path);
  return (existsSync(absolute) ? realpathSync(absolute) : absolute).replace(
    /\/+$/,
    "",
  );
}

function leaseKey(projectId: string, path: string): string {
  return createHash("sha256")
    .update(`${projectId}\0${path}`)
    .digest("hex")
    .slice(0, 24);
}

function contention(
  options: AcquireOptions,
  normalizedPath: string,
  key: string,
  conflictingSession: string,
  owner: string,
  method: string,
): CanonicalContention {
  return {
    state: "waiting",
    condition: {
      id: `canonical-mutation:${key}:${conflictingSession}:clear`,
      type: "session.state",
      subject: `session:${conflictingSession}`,
      expected: { field: "status", notEquals: "running" },
    },
    leaseKey: key,
    projectId: options.projectId,
    path: normalizedPath,
    conflictingSession,
    owner,
    observer: "canonical-mutation-lease",
    checkMethod: method,
    fallback:
      "Re-read the exact lease directory and live session row; never use a process-list-only gate.",
    affectedScope: `canonical checkout and shared Git metadata for ${normalizedPath}`,
  };
}

function sessionClaimsCanonical(meta: Record<string, unknown>, path: string) {
  const text = JSON.stringify(meta);
  return text.includes(path);
}

export function activeCanonicalSessions(
  projectId: string,
  canonicalPath: string,
  sessionsRoot = process.env.MAY_SESSIONS_DIR ?? "/app/.state/sessions",
): CanonicalLeaseHolder[] {
  if (!existsSync(sessionsRoot)) return [];
  return readdirSync(sessionsRoot, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || entry.name === "history") return [];
    const metaPath = join(sessionsRoot, entry.name, "meta.json");
    if (!existsSync(metaPath)) return [];
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf8"));
      if (
        meta.status !== "running" ||
        meta.projectId !== projectId ||
        !sessionClaimsCanonical(meta, canonicalPath)
      )
        return [];
      return [
        {
          sessionId: entry.name,
          owner: typeof meta.agent === "string" ? meta.agent : "unknown",
          taskId:
            typeof meta.taskId === "string"
              ? meta.taskId
              : typeof meta.task === "string"
                ? meta.task.slice(0, 160)
                : "unknown",
        },
      ];
    } catch {
      return [];
    }
  });
}

function appendCheckpoint(path: string | undefined, value: unknown): void {
  if (!path) return;
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value)}\n`, { flag: "a" });
}

export function acquireCanonicalMutationLease(
  options: AcquireOptions,
): CanonicalMutationLease {
  const normalizedPath = stablePath(options.canonicalPath);
  const key = leaseKey(options.projectId, normalizedPath);
  const root = resolve(
    options.leaseRoot ?? "/app/.state/leases/canonical-mutation",
  );
  const leaseDir = join(root, key);
  mkdirSync(root, { recursive: true });

  const sessions =
    options.activeSessions ??
    (() => activeCanonicalSessions(options.projectId, normalizedPath));
  const conflict = sessions().find(
    (session) => session.sessionId !== options.holder.sessionId,
  );
  if (conflict)
    throw new CanonicalMutationContentionError(
      contention(
        options,
        normalizedPath,
        key,
        conflict.sessionId,
        conflict.owner,
        "pre-mutation live session recheck from durable session metadata",
      ),
    );

  try {
    mkdirSync(leaseDir);
  } catch (error) {
    const holderPath = join(leaseDir, "holder.json");
    const existing = existsSync(holderPath)
      ? JSON.parse(readFileSync(holderPath, "utf8"))
      : { sessionId: "unknown", owner: "unknown" };
    throw new CanonicalMutationContentionError(
      contention(
        options,
        normalizedPath,
        key,
        String(existing.sessionId ?? "unknown"),
        String(existing.owner ?? "unknown"),
        "atomic mkdir lease acquisition keyed by normalized project and realpath",
      ),
    );
  }

  const token = randomUUID();
  writeFileSync(
    join(leaseDir, "holder.json"),
    `${JSON.stringify({ ...options.holder, token, projectId: options.projectId, path: normalizedPath, acquiredAt: new Date().toISOString() }, null, 2)}\n`,
  );
  let released = false;

  const recheck = (phase: string) => {
    const other = sessions().find(
      (session) => session.sessionId !== options.holder.sessionId,
    );
    if (other)
      throw new CanonicalMutationContentionError(
        contention(
          options,
          normalizedPath,
          key,
          other.sessionId,
          other.owner,
          `${phase} live session recheck from durable session metadata`,
        ),
      );
    const holder = JSON.parse(
      readFileSync(join(leaseDir, "holder.json"), "utf8"),
    );
    if (holder.token !== token)
      throw new Error(`canonical mutation lease ${key} changed holder`);
  };

  return {
    leaseKey: key,
    leaseDir,
    mutate<T>(label: string, operation: () => T): T {
      recheck("immediately-before-mutation");
      const before = options.fingerprint?.();
      const value = operation();
      const after = options.fingerprint?.();
      let postConflict: CanonicalContention | null = null;
      try {
        recheck("immediately-after-mutation");
      } catch (error) {
        if (error instanceof CanonicalMutationContentionError)
          postConflict = error.receipt;
        else throw error;
      }
      appendCheckpoint(options.checkpointPath, {
        schemaVersion: 1,
        observedAt: new Date().toISOString(),
        decision: postConflict
          ? "post-mutation-contention"
          : "mutation-verified",
        label,
        leaseKey: key,
        projectId: options.projectId,
        path: normalizedPath,
        holder: options.holder,
        before,
        after,
        postConflict,
      });
      if (postConflict)
        throw new CanonicalMutationContentionError(postConflict);
      return value;
    },
    release() {
      if (released) return;
      const holderPath = join(leaseDir, "holder.json");
      if (existsSync(holderPath)) {
        const holder = JSON.parse(readFileSync(holderPath, "utf8"));
        if (holder.token !== token)
          throw new Error(
            `refusing to release canonical lease ${key} owned by another token`,
          );
      }
      rmSync(leaseDir, { recursive: true, force: true });
      released = true;
      appendCheckpoint(options.checkpointPath, {
        schemaVersion: 1,
        observedAt: new Date().toISOString(),
        decision: "lease-released",
        leaseKey: key,
        holder: options.holder,
        finalFingerprint: options.fingerprint?.(),
      });
    },
  };
}

export function requiredMutationHolder(): CanonicalLeaseHolder {
  const sessionId = process.env.MAY_SESSION_ID;
  const taskId = process.env.MAY_TASK_ID;
  if (!sessionId || !taskId)
    throw new Error(
      "canonical mutation requires MAY_SESSION_ID and MAY_TASK_ID; refusing an unowned mutation",
    );
  return {
    sessionId,
    taskId,
    owner: process.env.MAY_AGENT ?? "app-ops",
  };
}
