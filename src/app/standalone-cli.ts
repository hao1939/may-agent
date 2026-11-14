import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  listTargets as listStandaloneTargets,
  run,
  type RunOptions as StandaloneRunOptions,
  type RunResult as DirectRunResult,
  type TargetSummary as DiscoveredTargetSummary,
} from "@may-agent/sdk/standalone";

export type ParsedStandaloneCliArgs =
  | {
      help: true;
      command: "run" | "list";
      target: "";
      input: "";
      json: boolean;
      needsStdin: false;
      options: StandaloneRunOptions<unknown>;
    }
  | {
      help?: false;
      command: "list";
      target: "";
      input: "";
      json: boolean;
      needsStdin: false;
      options: StandaloneRunOptions<unknown>;
    }
  | {
      help?: false;
      command: "run";
      target: string;
      input: unknown;
      json: boolean;
      needsStdin: boolean;
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

export function parseDurationMs(raw: string, flagName = "--timeout"): number {
  const trimmed = raw.trim();
  const match = /^([0-9]+(?:\.[0-9]+)?)(ms|s|m)?$/i.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid ${flagName} value: ${JSON.stringify(raw)} (expected e.g. 30000, 30s, or 2m)`);
  }
  const amount = Number(match[1]);
  const unit = (match[2] ?? "ms").toLowerCase();
  const multiplier = unit === "m" ? 60_000 : unit === "s" ? 1_000 : 1;
  const ms = Math.round(amount * multiplier);
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new Error(`Invalid ${flagName} value: ${JSON.stringify(raw)}`);
  }
  return ms;
}

function consumeOptionValue(
  argv: readonly string[],
  index: number,
  flag: string,
): { value: string; nextIndex: number } {
  const arg = argv[index]!;
  const eqIndex = arg.indexOf("=");
  if (eqIndex !== -1) {
    const inline = arg.slice(eqIndex + 1).trim();
    if (!inline) {
      throw new Error(`Option ${flag} requires a value`);
    }
    return { value: inline, nextIndex: index };
  }
  const next = argv[index + 1];
  if (next === undefined || !next.trim() || next.startsWith("-")) {
    throw new Error(`Option ${flag} requires a value`);
  }
  return { value: next, nextIndex: index + 1 };
}

export function parseStandaloneCliArgs(
  argv: readonly string[],
  stdinText?: string,
): ParsedStandaloneCliArgs {
  let command: "run" | "list" = "run";
  let startIdx = 0;
  if (argv[0] === "run" || argv[0] === "call") {
    command = "run";
    startIdx = 1;
  } else if (argv[0] === "list") {
    command = "list";
    startIdx = 1;
  }

  const positionals: string[] = [];
  const options: StandaloneRunOptions<unknown> = {};
  let json = false;
  let explicitInput: string | undefined;

  for (let i = startIdx; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "-h" || arg === "--help") {
      return {
        help: true,
        command,
        target: "",
        input: "",
        json: false,
        needsStdin: false,
        options,
      };
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
      const { value, nextIndex } = consumeOptionValue(argv, i, "--app");
      options.app = value;
      i = nextIndex;
      continue;
    }
    if (arg === "--input" || arg.startsWith("--input=")) {
      const { value, nextIndex } = consumeOptionValue(argv, i, "--input");
      explicitInput = value;
      i = nextIndex;
      continue;
    }
    if (arg === "--cwd" || arg.startsWith("--cwd=") || arg === "--work-root" || arg.startsWith("--work-root=")) {
      const flag = arg.startsWith("--cwd") ? "--cwd" : "--work-root";
      const { value, nextIndex } = consumeOptionValue(argv, i, flag);
      options.cwd = resolve(value);
      options.workRoot = resolve(value);
      i = nextIndex;
      continue;
    }
    if (arg === "--project-root" || arg.startsWith("--project-root=")) {
      const { value, nextIndex } = consumeOptionValue(argv, i, "--project-root");
      options.projectRoot = resolve(value);
      i = nextIndex;
      continue;
    }
    if (
      arg === "--out" ||
      arg.startsWith("--out=") ||
      arg === "--output-root" ||
      arg.startsWith("--output-root=")
    ) {
      const flag = arg.startsWith("--out=") || arg === "--out" ? "--out" : "--output-root";
      const { value, nextIndex } = consumeOptionValue(argv, i, flag);
      const resolvedOut = resolve(value);
      options.outputRoot = resolvedOut;
      options.traceDir ??= resolvedOut;
      i = nextIndex;
      continue;
    }
    if (arg === "--timeout" || arg.startsWith("--timeout=")) {
      const { value, nextIndex } = consumeOptionValue(argv, i, "--timeout");
      options.timeoutMs = parseDurationMs(value, "--timeout");
      i = nextIndex;
      continue;
    }
    if (arg === "--skill" || arg.startsWith("--skill=")) {
      const { value, nextIndex } = consumeOptionValue(argv, i, "--skill");
      options.skill = value;
      i = nextIndex;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    positionals.push(arg);
  }

  if (command === "list") {
    if (positionals.length > 0) {
      throw new Error(`Unexpected positional arguments for 'list': ${positionals.join(" ")}`);
    }
    return {
      command: "list",
      target: "",
      input: "",
      json,
      needsStdin: false,
      options,
    };
  }

  const target = positionals[0]?.trim() ?? "";
  if (!target) {
    throw new Error("Missing required <target> argument (e.g. `may run alex \"...\"` or `may run tech-lead/verified-coder '{...}'`)");
  }

  const hasExplicitOrPositionalInput = explicitInput !== undefined || positionals.length > 1;
  const rawInput =
    explicitInput ??
    (positionals.length > 1 ? positionals.slice(1).join(" ") : undefined) ??
    stdinText ??
    "";

  return {
    command: "run",
    target,
    input: parseStandaloneInput(rawInput),
    json,
    needsStdin: !hasExplicitOrPositionalInput && stdinText === undefined,
    options,
  };
}

export const MAY_RUN_CLI_USAGE = `Usage:
  may run <target> [input] [options]
  may list [options]

Examples:
  may run alex "Summarize README.md" --readonly
  may run tech-lead/verified-coder '{"task":"Fix bug","verify":["bun","test"]}'
  may run codex "Inspect package.json"
  git diff | may run alex/review-change --readonly
  may list

Options:
  --readonly            Enforce read-only tool & procedure restrictions
  --input <text|json>   Explicit input string or JSON object
  --cwd <dir>           Working directory for execution (default: current directory)
  --out <dir>           Output directory for run.json and sessions/
  --timeout <duration>  Timeout (e.g. 45000, 45s, 2m)
  --skill <name>        Optional skill hint for prompt targets
  --app <name>          Optional App disambiguator if target exists in multiple Apps
  --project-root <dir>  Workspace root override (auto-inferred from cwd)
  --json                Print structured JSON output
  -h, --help            Show this usage text
`;

export const STANDALONE_CLI_USAGE = MAY_RUN_CLI_USAGE;

export async function runStandaloneCli(
  argv: readonly string[],
  deps: {
    stdinText?: string;
    readStdin?: () => string | undefined;
    execute?: typeof run;
    listTargets?: (opts: {
      cwd?: string;
      projectRoot?: string;
      app?: string;
      timeoutMs?: number;
      signal?: AbortSignal;
    }) => Promise<DiscoveredTargetSummary[]> | DiscoveredTargetSummary[];
    stdout?: (text: string) => void;
    stderr?: (text: string) => void;
  } = {},
): Promise<{ exitCode: number; result?: DirectRunResult; targets?: DiscoveredTargetSummary[] }> {
  const writeOut = deps.stdout ?? ((text: string) => process.stdout.write(`${text}\n`));
  const writeErr = deps.stderr ?? ((text: string) => process.stderr.write(`${text}\n`));

  let parsed: ParsedStandaloneCliArgs;
  try {
    parsed = parseStandaloneCliArgs(argv, deps.stdinText);
  } catch (err) {
    writeErr(err instanceof Error ? err.message : String(err));
    writeErr(MAY_RUN_CLI_USAGE);
    return { exitCode: 1 };
  }

  if (parsed.help) {
    writeOut(MAY_RUN_CLI_USAGE);
    return { exitCode: 0 };
  }

  const sigController = new AbortController();
  const callerSignal = parsed.options.signal;
  const onCallerAbort = () => {
    sigController.abort(callerSignal?.reason ?? new Error("Standalone execution cancelled"));
  };
  if (callerSignal?.aborted) {
    onCallerAbort();
  } else if (callerSignal) {
    callerSignal.addEventListener("abort", onCallerAbort, { once: true });
  }
  const onSigInt = () => {
    sigController.abort(new Error("Standalone execution interrupted by SIGINT"));
  };
  const onSigTerm = () => {
    sigController.abort(new Error("Standalone execution terminated by SIGTERM"));
  };
  process.on("SIGINT", onSigInt);
  process.on("SIGTERM", onSigTerm);

  try {
    if (parsed.command === "list") {
      const discover = deps.listTargets ?? listStandaloneTargets;
      const targets = await discover({
        cwd: parsed.options.cwd,
        projectRoot: parsed.options.projectRoot,
        app: parsed.options.app,
        timeoutMs: parsed.options.timeoutMs,
        signal: sigController.signal,
      });
      if (parsed.json) {
        writeOut(JSON.stringify(targets, null, 2));
      } else if (targets.length === 0) {
        writeOut("No callable targets discovered.");
      } else {
        for (const item of targets) {
          const scope = item.app ? ` [${item.app}]` : "";
          writeOut(`${item.target.padEnd(32)} (${item.kind})${scope} — ${item.description}`);
        }
      }
      return { exitCode: 0, targets };
    }

    let effectiveInput = parsed.input;
    if (parsed.needsStdin && deps.readStdin) {
      const piped = deps.readStdin();
      if (piped !== undefined) {
        effectiveInput = parseStandaloneInput(piped);
      }
    }

    const execute = deps.execute ?? run;
    const runResult = await execute(parsed.target, effectiveInput, {
      ...parsed.options,
      signal: sigController.signal,
    });

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
  } finally {
    process.off("SIGINT", onSigInt);
    process.off("SIGTERM", onSigTerm);
    callerSignal?.removeEventListener("abort", onCallerAbort);
  }
}

export function readPipedStdinSync(): string | undefined {
  if (process.stdin.isTTY) return undefined;
  return readFileSync(0, "utf8");
}

if (import.meta.main) {
  const { exitCode } = await runStandaloneCli(process.argv.slice(2), {
    readStdin: readPipedStdinSync,
  });
  process.exit(exitCode);
}
