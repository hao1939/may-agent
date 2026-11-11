import { spawn } from "node:child_process";

const shardCount = 2;

/** Use Bun's file partitioning, retaining a module cache within each process. */
export function shardArguments(args: string[], shard: number): string[] {
  return args.map((arg, index) => {
    const output = arg.startsWith("--reporter-outfile=")
      ? arg.slice("--reporter-outfile=".length)
      : args[index - 1] === "--reporter-outfile"
        ? arg
        : undefined;
    if (output === undefined) return arg;
    const path = `${output.replace(/\.xml$/, "")}.${shard}.xml`;
    return arg.startsWith("--reporter-outfile=") ? `--reporter-outfile=${path}` : path;
  });
}

export async function runTests(args: string[]): Promise<number> {
  if (args.some((arg) => /^--(?:shard|parallel|isolate)(?:=|$)/.test(arg))) {
    throw new Error("This command owns test partitioning; use bun test directly for another isolation mode");
  }
  const children = Array.from({ length: shardCount }, (_, index) =>
    spawn(
      process.execPath,
      [
        "test",
        "--no-orphans",
        "--timeout=30000",
        `--shard=${index + 1}/${shardCount}`,
        ...shardArguments(args, index + 1),
      ],
      { stdio: "inherit" },
    ),
  );
  const stop = (signal: NodeJS.Signals) => {
    for (const child of children) child.kill(signal);
  };
  const interrupt = () => stop("SIGINT");
  const terminate = () => stop("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  try {
    const codes = await Promise.all(
      children.map(
        (child) =>
          new Promise<number>((resolve) => {
            child.once("error", (error) => {
              console.error(error);
              resolve(1);
            });
            child.once("close", (code) => resolve(code ?? 1));
          }),
      ),
    );
    return codes.some((code) => code !== 0) ? 1 : 0;
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  }
}

if (import.meta.main) process.exitCode = await runTests(process.argv.slice(2));
