import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

export type OwnedCommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

type OwnedCommandMarker = {
  version: 1;
  pgid: number;
  token: string;
  command: string;
  cwd: string;
  startedAt: string;
};

export type OwnedCommandOptions = {
  command: string;
  args: string[];
  cwd: string;
  ownerFile: string;
  env?: Record<string, string>;
  timeoutMs: number;
  maxOutputChars: number;
};

const pollMs = 20;
const termGraceMs = 1_000;
const killGraceMs = 2_000;
const ownerTokenEnv = "MAY_OWNED_COMMAND_TOKEN";

function readMarker(path: string): OwnedCommandMarker | null {
  try {
    const marker = JSON.parse(
      readFileSync(path, "utf8"),
    ) as Partial<OwnedCommandMarker>;
    if (
      marker.version !== 1 ||
      !Number.isInteger(marker.pgid) ||
      Number(marker.pgid) <= 0 ||
      typeof marker.token !== "string" ||
      !marker.token
    ) {
      return null;
    }
    return marker as OwnedCommandMarker;
  } catch {
    return null;
  }
}

function writeMarker(path: string, marker: OwnedCommandMarker): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp.${process.pid}.${marker.token}`;
  writeFileSync(temporary, `${JSON.stringify(marker, null, 2)}\n`);
  renameSync(temporary, path);
}

function removeMarker(path: string, token?: string): void {
  if (token && readMarker(path)?.token !== token) return;
  rmSync(path, { force: true });
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function processGroup(pid: number): number | null {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    return Number(fields[2]) || null;
  } catch {
    return null;
  }
}

function hasOwnerToken(pid: number, token: string): boolean {
  try {
    const environment = readFileSync(`/proc/${pid}/environ`, "utf8");
    return environment.split("\0").includes(`${ownerTokenEnv}=${token}`);
  } catch {
    return false;
  }
}

function ownedGroupAlive(
  marker: Pick<OwnedCommandMarker, "pgid" | "token">,
): boolean {
  try {
    for (const entry of readdirSync("/proc")) {
      if (!/^\d+$/.test(entry)) continue;
      const pid = Number(entry);
      if (processGroup(pid) === marker.pgid && hasOwnerToken(pid, marker.token))
        return true;
    }
  } catch {
    return false;
  }
  return false;
}

function signalGroup(pgid: number, signal: "SIGTERM" | "SIGKILL"): void {
  try {
    process.kill(-pgid, signal);
  } catch {
    // The exact process group already exited.
  }
}

async function waitUntil(
  predicate: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return !predicate();
}

async function drainOwnedGroup(marker: OwnedCommandMarker): Promise<void> {
  // Close the short fork/exec window in which setsid has a PID but has not yet
  // created the matching group. Never signal the daemon's inherited group.
  if (processExists(marker.pgid) && processGroup(marker.pgid) !== marker.pgid) {
    await waitUntil(
      () =>
        processExists(marker.pgid) && processGroup(marker.pgid) !== marker.pgid,
      250,
    );
  }
  if (!ownedGroupAlive(marker)) return;
  signalGroup(marker.pgid, "SIGTERM");
  if (await waitUntil(() => ownedGroupAlive(marker), termGraceMs)) return;
  signalGroup(marker.pgid, "SIGKILL");
  await waitUntil(() => ownedGroupAlive(marker), killGraceMs);
}

export async function drainOwnedCommand(ownerFile: string): Promise<void> {
  const marker = readMarker(ownerFile);
  if (!marker) {
    if (existsSync(ownerFile)) removeMarker(ownerFile);
    return;
  }
  await drainOwnedGroup(marker);
  removeMarker(ownerFile, marker.token);
}

/** Run one sequential workflow command without blocking the daemon event loop. */
export async function runOwnedCommand(
  options: OwnedCommandOptions,
): Promise<OwnedCommandResult> {
  await drainOwnedCommand(options.ownerFile);

  const token = randomUUID();
  const child = spawn("/usr/bin/setsid", [options.command, ...options.args], {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
      [ownerTokenEnv]: token,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (!child.pid) {
    const error = await new Promise<string>((resolve) => {
      child.once("error", (cause) => resolve(cause.message));
    });
    return {
      status: null,
      stdout: "",
      stderr: error,
      timedOut: false,
    };
  }

  const marker: OwnedCommandMarker = {
    version: 1,
    pgid: child.pid,
    token,
    command: [options.command, ...options.args].join(" "),
    cwd: options.cwd,
    startedAt: new Date().toISOString(),
  };
  try {
    writeMarker(options.ownerFile, marker);
  } catch (error) {
    await drainOwnedGroup(marker);
    throw error;
  }

  let stdout = "";
  let stderr = "";
  let timedOut = false;
  const append = (current: string, chunk: Buffer | string): string =>
    `${current}${String(chunk)}`.slice(-options.maxOutputChars);
  child.stdout?.on("data", (chunk) => {
    stdout = append(stdout, chunk);
  });
  child.stderr?.on("data", (chunk) => {
    stderr = append(stderr, chunk);
  });

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const completion = await new Promise<{
    status: number | null;
    error?: string;
  }>((resolve) => {
    let settled = false;
    const finish = (status: number | null, error?: string) => {
      if (settled) return;
      settled = true;
      resolve({ status, error });
    };
    child.once("error", (error) => finish(null, error.message));
    child.once("close", (status) => finish(status));
    timeout = setTimeout(() => {
      timedOut = true;
      void drainOwnedGroup(marker);
    }, options.timeoutMs);
    timeout.unref();
  });

  if (timeout) clearTimeout(timeout);
  await drainOwnedGroup(marker);
  removeMarker(options.ownerFile, token);
  if (completion.error) stderr = append(stderr, completion.error);
  if (timedOut)
    stderr = append(stderr, `\nCommand timed out after ${options.timeoutMs}ms`);
  return { status: completion.status, stdout, stderr, timedOut };
}
