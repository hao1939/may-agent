import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import * as os from "node:os";
import { isAbsolute, join, matchesGlob, relative, resolve, resolve as resolvePath, sep } from "node:path";

const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const NARROW_NO_BREAK_SPACE = "\u202F";
function normalizeUnicodeSpaces(str: string): string {
	return str.replace(UNICODE_SPACES, " ");
}

function tryMacOSScreenshotPath(filePath: string): string {
	return filePath.replace(/ (AM|PM)\./g, `${NARROW_NO_BREAK_SPACE}$1.`);
}

function tryNFDVariant(filePath: string): string {
	// macOS stores filenames in NFD (decomposed) form, try converting user input to NFD
	return filePath.normalize("NFD");
}

function tryCurlyQuoteVariant(filePath: string): string {
	// macOS uses U+2019 (right single quotation mark) in screenshot names like "Capture d'écran"
	// Users typically type U+0027 (straight apostrophe)
	return filePath.replace(/'/g, "\u2019");
}

function fileExists(filePath: string): boolean {
	try {
		accessSync(filePath, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

function normalizeAtPrefix(filePath: string): string {
	return filePath.startsWith("@") ? filePath.slice(1) : filePath;
}

export function expandPath(filePath: string): string {
	const normalized = normalizeUnicodeSpaces(normalizeAtPrefix(filePath));
	if (normalized === "~") {
		return os.homedir();
	}
	if (normalized.startsWith("~/")) {
		return os.homedir() + normalized.slice(1);
	}
	return normalized;
}

/**
 * Resolve a path relative to the given cwd.
 * Handles ~ expansion and absolute paths.
 */
export function resolveToCwd(filePath: string, cwd: string): string {
	const expanded = expandPath(filePath);
	if (isAbsolute(expanded)) {
		return expanded;
	}
	return resolvePath(cwd, expanded);
}

export function resolveReadPath(filePath: string, cwd: string): string {
	const resolved = resolveToCwd(filePath, cwd);

	if (fileExists(resolved)) {
		return resolved;
	}

	// Try macOS AM/PM variant (narrow no-break space before AM/PM)
	const amPmVariant = tryMacOSScreenshotPath(resolved);
	if (amPmVariant !== resolved && fileExists(amPmVariant)) {
		return amPmVariant;
	}

	// Try NFD variant (macOS stores filenames in NFD form)
	const nfdVariant = tryNFDVariant(resolved);
	if (nfdVariant !== resolved && fileExists(nfdVariant)) {
		return nfdVariant;
	}

	// Try curly quote variant (macOS uses U+2019 in screenshot names)
	const curlyVariant = tryCurlyQuoteVariant(resolved);
	if (curlyVariant !== resolved && fileExists(curlyVariant)) {
		return curlyVariant;
	}

	// Try combined NFD + curly quote (for French macOS screenshots like "Capture d'écran")
	const nfdCurlyVariant = tryCurlyQuoteVariant(nfdVariant);
	if (nfdCurlyVariant !== resolved && fileExists(nfdCurlyVariant)) {
		return nfdCurlyVariant;
	}

	return resolved;
}


/**
 * Shared abort-signal utilities for tool implementations.
 *
 * All three file tools (read, write, edit) share the same abort-signal
 * boilerplate: check if already aborted, set up a listener, wrap async
 * work in a Promise, and clean up the listener on every exit path.
 *
 * This module extracts that pattern into a single helper.
 */

/**
 * Wraps an async operation with abort-signal support.
 *
 * Handles:
 * - Pre-check: rejects immediately if signal is already aborted
 * - Listener: registers an "abort" listener that rejects and sets a flag
 * - Cleanup: removes the listener on success, error, or abort
 * - Flag: passes an `isAborted()` function so the inner work can bail early
 *
 * @template T - The type of the value the wrapped operation resolves to
 * @param signal - Optional AbortSignal from the tool call. If undefined,
 *                 the work runs without abort support.
 * @param work - Async function that does the real work. Receives an `isAborted`
 *               checker so it can bail early during long-running operations.
 *               Must return the resolved value of type T.
 * @returns A promise that resolves with the result of `work`, or rejects with
 *          an `Error("Operation aborted")` if the signal fires before completion.
 * @throws {Error} "Operation aborted" — if `signal` is already aborted at call time,
 *         or if `signal` fires while `work` is still running.
 *
 * @example
 * ```ts
 * const result = await withAbortSignal(signal, async (isAborted) => {
 *   const data = await readFile(path);
 *   if (isAborted()) return "";
 *   return data.toString();
 * });
 * ```
 */
export function withAbortSignal<T>(
  signal: AbortSignal | undefined,
  work: (isAborted: () => boolean) => Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Operation aborted"));
      return;
    }

    let aborted = false;
    const onAbort = () => {
      aborted = true;
      reject(new Error("Operation aborted"));
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    const cleanup = () => {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    };

    work(() => aborted)
      .then((result) => {
        if (!aborted) {
          cleanup();
          resolve(result);
        }
      })
      .catch((error) => {
        cleanup();
        if (!aborted) {
          reject(error);
        }
      });
  });
}

/** Trusted installation declarations, captured with the selected definition generation. */
export interface FileWritePolicy {
  readonly root: string;
  /** Trusted checkout mapping; sourceRoot retains its installation-relative scope. */
  readonly execution?: { readonly root: string; readonly sourceRoot: string };
  readonly protectedPaths: readonly string[];
  readonly grants: readonly {
    readonly paths: readonly string[];
    readonly writers: readonly string[];
  }[];
}

function paths(value: unknown): readonly string[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (p) =>
        typeof p === "string" &&
        p.trim() === p &&
        p.length &&
        !isAbsolute(p) &&
        !p.includes("\\") &&
        !p.split("/").includes(".."),
    )
  ) {
    throw new Error("File policy requires installation-relative path patterns without traversal");
  }
  return Object.freeze([...value]);
}

export function readFileWritePolicy(sharedRoot: string, root = resolve(sharedRoot, "..")): FileWritePolicy {
  const path = join(sharedRoot, "file-write-policy.json");
  if (!existsSync(path)) return Object.freeze({ root, protectedPaths: Object.freeze([]), grants: Object.freeze([]) });
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (!value || typeof value !== "object" || !Array.isArray(value.grants)) {
    throw new Error("file-write-policy.json requires protectedPaths and grants arrays");
  }
  const protectedPaths = paths(value.protectedPaths);
  const grants = value.grants.map((grant: unknown) => {
    if (!grant || typeof grant !== "object") throw new Error("Invalid file write grant");
    const { paths: scope, writers } = grant as { paths?: unknown; writers?: unknown };
    if (!Array.isArray(writers) || !writers.every((w) => typeof w === "string" && w.trim() === w && w.length)) {
      throw new Error("File write grants require explicit writer identities");
    }
    return Object.freeze({ paths: paths(scope), writers: Object.freeze([...writers]) });
  });
  return Object.freeze({ root, protectedPaths, grants: Object.freeze(grants) });
}

/** File-tool safeguards. Domain paths and writer grants come from installation policy. */
const PROTECTED_FILENAMES = new Set(["AGENTS.md", "agent.json", "heartbeat.md"]);

export interface CrossEditGuardResult {
  blocked: boolean;
  message?: string;
}

interface AgentTreePath {
  displayPrefix: string;
  relPath: string;
  parts: string[];
  targetDir: string;
  fileName: string;
}

function isInsidePath(absolutePath: string, parentPath: string): boolean {
  return absolutePath === parentPath || absolutePath.startsWith(parentPath + sep);
}

function splitPath(path: string): string[] {
  return path.split(sep).filter(Boolean);
}

function agentTreePathFromRoot(
  absolutePath: string,
  agentRoot: string,
  displayPrefix: string,
): AgentTreePath | undefined {
  if (!isInsidePath(absolutePath, agentRoot)) return undefined;

  const relPath = relative(agentRoot, absolutePath);
  const parts = splitPath(relPath);
  if (parts.length < 2 || parts[0].startsWith(".")) return undefined;

  return {
    displayPrefix,
    relPath,
    parts,
    targetDir: parts[0],
    fileName: parts[parts.length - 1],
  };
}

function findAgentTreePath(absolutePath: string, projectRoot: string): AgentTreePath | undefined {
  const root = resolve(projectRoot);

  const globalAgentPath = agentTreePathFromRoot(absolutePath, resolve(root, "agents"), "agents");
  if (globalAgentPath) return globalAgentPath;

  const projectsDir = resolve(root, "projects");
  if (!isInsidePath(absolutePath, projectsDir)) return undefined;

  const projectParts = splitPath(relative(projectsDir, absolutePath));

  // V3 app-local agents: projects/<project>.app/agents/<agent>/...
  if (projectParts.length >= 4 && projectParts[1] === "agents") {
    return agentTreePathFromRoot(
      absolutePath,
      resolve(projectsDir, projectParts[0], "agents"),
      ["projects", projectParts[0], "agents"].join(sep),
    );
  }

  // Legacy embedded app agents: projects/<project>/.app/agents/<agent>/...
  if (projectParts.length >= 5 && projectParts[1] === ".app" && projectParts[2] === "agents") {
    return agentTreePathFromRoot(
      absolutePath,
      resolve(projectsDir, projectParts[0], ".app", "agents"),
      ["projects", projectParts[0], ".app", "agents"].join(sep),
    );
  }

  return undefined;
}

export function checkCrossEditGuard(
  absolutePath: string,
  agentName: string | undefined,
  projectRoot: string,
  policy?: FileWritePolicy,
): CrossEditGuardResult {
  if (!agentName) return { blocked: false };
  const rel = relative(resolve(projectRoot), resolve(absolutePath)).split(sep).join("/");
  const deny = (): CrossEditGuardResult => ({
    blocked: true,
    message: `WRITE BLOCKED: Agent '${agentName}' has no declared permission to modify ${rel}. Report the blocked path and reason to your caller; do not bypass the guard.`,
  });
  const absolutePaths = [resolve(absolutePath)];
  const execution = policy?.execution;
  if (execution && isInsidePath(resolve(absolutePath), resolve(execution.root))) {
    absolutePaths.push(resolve(execution.sourceRoot, relative(resolve(execution.root), resolve(absolutePath))));
  }
  const paths = [...new Set(absolutePaths)]
    .map((path) => relative(resolve(policy?.root ?? projectRoot), path).split(sep).join("/"))
    .filter((path) => path !== ".." && !path.startsWith("../"));
  // The policy itself is operator-owned. A file-tool grant cannot rewrite its own authority.
  if (paths.includes("shared/file-write-policy.json")) return deny();
  const matches = (patterns: readonly string[]) =>
    patterns.some((pattern) => paths.some((path) => matchesGlob(path, pattern)));
  if (policy?.grants.some((grant) => grant.writers.includes(agentName) && matches(grant.paths)))
    return { blocked: false };
  if (policy && matches(policy.protectedPaths)) return deny();
  if (
    [
      "shared/common-sense.md",
      "shared/philosophy.md",
      "agents/shared/common-sense.md",
      "agents/shared/philosophy.md",
    ].some((path) => paths.includes(path) || rel === path)
  )
    return deny();
  const target =
    (policy?.root ? absolutePaths.map(path => findAgentTreePath(path, policy.root)).find(Boolean) : undefined) ??
    findAgentTreePath(resolve(absolutePath), projectRoot);
  if (!target || !PROTECTED_FILENAMES.has(target.fileName)) return { blocked: false };
  if (target.fileName === "agent.json" || target.targetDir !== agentName) return deny();
  return { blocked: false };
}
