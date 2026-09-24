import { statSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildLibraryHealthPacket,
  type LibraryHealthPacket,
} from "../agents/scout/workflows/library-health.js";

export type ReadonlyLibraryHealthResult = {
  appDir: string;
  projectDir: string;
  generatedAt: string;
  factCount: number;
  wakeSignalCount: number;
  truncated: boolean;
  observations: LibraryHealthPacket["observations"];
  facts: LibraryHealthPacket["facts"];
  wakeDecisions: LibraryHealthPacket["wake_decisions"];
};

type Options = {
  appDir: string;
  projectDir: string;
  now?: number;
};

function directory(path: string, label: string): string {
  let isDirectory = false;
  try {
    isDirectory = statSync(path).isDirectory();
  } catch {
    // The error below gives callers the same stable diagnostic for missing and
    // non-directory paths without exposing unrelated filesystem details.
  }
  if (!isDirectory) throw new Error(`${label} is not a directory: ${path}`);
  return path;
}

function optionValue(args: string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

export function parseReadonlyLibraryHealthOptions(
  args: string[],
  defaults: { appDir: string; projectDir: string },
): Options {
  let appDir = defaults.appDir;
  let projectDir = defaults.projectDir;
  let now: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--app-dir") {
      appDir = resolve(optionValue(args, index, arg));
      index += 1;
    } else if (arg === "--project-dir") {
      projectDir = resolve(optionValue(args, index, arg));
      index += 1;
    } else if (arg === "--now") {
      const value = optionValue(args, index, arg);
      now = Date.parse(value);
      if (!Number.isFinite(now))
        throw new Error(`Invalid --now value: ${value}`);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    appDir: directory(resolve(appDir), "App directory"),
    projectDir: directory(resolve(projectDir), "Project directory"),
    now,
  };
}

export function inspectLibraryHealthReadonly(
  options: Options,
): ReadonlyLibraryHealthResult {
  const packet = buildLibraryHealthPacket(options);
  return {
    appDir: options.appDir,
    projectDir: options.projectDir,
    generatedAt: packet.generated_at,
    factCount: packet.facts.length,
    wakeSignalCount: packet.wake_signals.length,
    truncated: packet.truncated,
    observations: packet.observations,
    facts: packet.facts,
    wakeDecisions: packet.wake_decisions,
  };
}

if (import.meta.main) {
  const appDir = resolve(import.meta.dir, "..");
  const options = parseReadonlyLibraryHealthOptions(process.argv.slice(2), {
    appDir,
    projectDir: resolve(appDir, "../scout-knowledge-lib"),
  });
  process.stdout.write(
    `${JSON.stringify(inspectLibraryHealthReadonly(options), null, 2)}\n`,
  );
}
