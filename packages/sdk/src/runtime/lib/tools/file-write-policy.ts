import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

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
