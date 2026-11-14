import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { run, type DirectRunResult, type StandaloneRunOptions } from "./standalone.js";

export type ParsedStandaloneCliArgs = {
  help?: boolean;
  target: string;
  input: unknown;
  json: boolean;
  options: StandaloneRunOptions<unknown>;
};

export function parseStandaloneInput(raw: string): unknown {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}

export function parseStandaloneCliArgs(
  argv: readonly string[],
  stdinText?: string,
): ParsedStandaloneCliArgs {
  const positionals: string[] = [];
  const options: StandaloneRunOptions<unknown> = {};
  let json = false;
  let explicitInput: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "-h" || arg === "--help") {
      return { help: true, target: "", input: "", json: false, options };
    }
    if (arg === "--readonly") {
      options.tools = "readonly";
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--app" || arg.startsWith("--app=")) {
      options.app = arg.includes("=") ? arg.slice("--app=".length) : argv[++i];
      continue;
    }
    if (arg === "--input" || arg.startsWith("--input=")) {
      explicitInput = arg.includes("=") ? arg.slice("--input=".length) : argv[++i];
      continue;
    }
    if (arg === "--project-root" || arg.startsWith("--project-root=")) {
      const val = arg.includes("=") ? arg.slice("--project-root=".length) : argv[++i];
      if (val) options.projectRoot = resolve(val);
      continue;
    }
    if (arg === "--work-root" || arg.startsWith("--work-root=")) {
      const val = arg.includes("=") ? arg.slice("--work-root=".length) : argv[++i];
      if (val) options.workRoot = resolve(val);
      continue;
    }
    if (arg === "--output-root" || arg.startsWith("--output-root=")) {
      const val = arg.includes("=") ? arg.slice("--output-root=".length) : argv[++i];
      if (val) {
        options.outputRoot = resolve(val);
        options.traceDir ??= resolve(val);
      }
      continue;
    }
    if (arg === "--timeout" || arg.startsWith("--timeout=")) {
      const rawTimeout = arg.includes("=") ? arg.slice("--timeout=".length) : argv[++i];
      const parsed = Number(rawTimeout);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --timeout value: ${JSON.stringify(rawTimeout)}`);
      }
      options.timeoutMs = parsed;
      continue;
    }
    if (arg === "--skill" || arg.startsWith("--skill=")) {
      options.skill = arg.includes("=") ? arg.slice("--skill=".length) : argv[++i];
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    positionals.push(arg);
  }

  const target = positionals[0]?.trim() ?? "";
  if (!target) {
    throw new Error("Missing required <target> argument (e.g. `alex` or `tech-lead/verified-coder`)");
  }

  const rawInput =
    explicitInput ??
    (positionals.length > 1 ? positionals.slice(1).join(" ") : undefined) ??
    stdinText ??
    "";

  return {
    target,
    input: parseStandaloneInput(rawInput),
    json,
    options,
  };
}

export const STANDALONE_CLI_USAGE = `Usage:
  bun run standalone <target> [input] [options]

Examples:
  bun run standalone alex "Summarize README.md" --app alex.app --readonly
  bun run standalone tech-lead/verified-coder '{"task":"Fix bug","verify":["bun","test"]}' --app alex.app
  bun run standalone codex "Inspect package.json" --readonly
  git diff | bun run standalone alex/review-change --app alex.app --readonly

Options:
  --app <name>          App directory under projects/ (e.g. alex.app, may.app)
  --input <text|json>   Explicit input string or JSON object
  --readonly            Enforce read-only tool & procedure restrictions
  --work-root <dir>     Working directory for execution (default: projectRoot)
  --output-root <dir>   Output directory for run.json and sessions/
  --project-root <dir>  Repository root directory (default: cwd)
  --timeout <ms>        Timeout in milliseconds
  --skill <name>        Optional skill hint for prompt targets
  --json                Print full DirectRunResult as JSON
  -h, --help            Show this usage text
`;

export async function runStandaloneCli(
  argv: readonly string[],
  deps: {
    stdinText?: string;
    execute?: typeof run;
    stdout?: (text: string) => void;
    stderr?: (text: string) => void;
  } = {},
): Promise<{ exitCode: number; result?: DirectRunResult }> {
  const writeOut = deps.stdout ?? ((text: string) => process.stdout.write(`${text}\n`));
  const writeErr = deps.stderr ?? ((text: string) => process.stderr.write(`${text}\n`));

  let parsed: ParsedStandaloneCliArgs;
  try {
    parsed = parseStandaloneCliArgs(argv, deps.stdinText);
  } catch (err) {
    writeErr(err instanceof Error ? err.message : String(err));
    writeErr(STANDALONE_CLI_USAGE);
    return { exitCode: 1 };
  }

  if (parsed.help) {
    writeOut(STANDALONE_CLI_USAGE);
    return { exitCode: 0 };
  }

  const execute = deps.execute ?? run;
  const runResult = await execute(parsed.target, parsed.input, parsed.options);

  if (parsed.json) {
    writeOut(JSON.stringify(runResult, null, 2));
  } else if (runResult.ok && runResult.result) {
    const summary =
      runResult.result.type === "done" ? runResult.result.summary : runResult.result.reason;
    writeOut(`[${runResult.status}] ${summary}`);
    if (runResult.result.output !== undefined) {
      writeOut(
        typeof runResult.result.output === "string"
          ? runResult.result.output
          : JSON.stringify(runResult.result.output, null, 2),
      );
    }
  } else {
    const msg =
      runResult.error instanceof Error
        ? runResult.error.message
        : (runResult.report.error?.message ?? "Execution failed");
    writeErr(`[${runResult.status}] ${msg}`);
  }

  return {
    exitCode: runResult.ok && runResult.status === "done" ? 0 : 1,
    result: runResult,
  };
}

if (import.meta.main) {
  const stdinText = !process.stdin.isTTY ? readFileSync(0, "utf8") : undefined;
  const { exitCode } = await runStandaloneCli(process.argv.slice(2), { stdinText });
  process.exit(exitCode);
}
