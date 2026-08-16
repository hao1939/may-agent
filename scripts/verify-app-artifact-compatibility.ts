#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { listAppDefinitionFiles, loadAppDefinitions } from "../src/app/loader/app-loader.js";

function requiredPath(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return realpathSync(resolve(value));
}

function treeDigest(root: string): string {
  const hash = createHash("sha256");
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile()) {
        hash.update(relative(root, path));
        hash.update("\0");
        hash.update(readFileSync(path));
        hash.update("\0");
      }
    }
  };
  visit(root);
  return hash.digest("hex");
}

const appsRoot = requiredPath("MAY_AGENT_VERIFY_APPS_ROOT");
const sdkRoot = requiredPath("MAY_AGENT_VERIFY_SDK_ROOT");
const appFiles = listAppDefinitionFiles(appsRoot);
if (appFiles.length === 0) throw new Error(`No App definitions found under ${appsRoot}`);

const cacheRoot = mkdtempSync(join(tmpdir(), "may-agent-app-artifact-"));
const previousSdkRoot = process.env.MAY_AGENT_SDK_ROOT;
process.env.MAY_AGENT_SDK_ROOT = sdkRoot;

try {
  const loaded = await loadAppDefinitions(appsRoot, {
    forceBundle: true,
    cacheDir: join(cacheRoot, "cache"),
  });
  if (loaded.length !== appFiles.length) {
    throw new Error(`Loaded ${loaded.length} Apps from ${appFiles.length} definitions`);
  }
  console.log(
    JSON.stringify(
      {
        appsRoot,
        sdkRoot,
        sdkTreeSha256: treeDigest(sdkRoot),
        appCount: loaded.length,
        apps: loaded.map(({ definition }) => definition.id).sort(),
        legacyApps: loaded
          .filter(({ compatibility }) => compatibility === "legacy-project-app")
          .map(({ definition }) => definition.id)
          .sort(),
      },
      null,
      2,
    ),
  );
} finally {
  if (previousSdkRoot === undefined) delete process.env.MAY_AGENT_SDK_ROOT;
  else process.env.MAY_AGENT_SDK_ROOT = previousSdkRoot;
  rmSync(cacheRoot, { recursive: true, force: true });
}
