/** Conservative recognition of fixture test execution, not a shell/JS interpreter.
 * Unknown scripts remain reviewable; recognizable syntax checks never count as
 * running a test. No command from a transcript is executed by this module. */
import { basename, join, resolve } from "node:path";

export type VerificationMethod = "test" | "none" | "review";

// Only simple argv and && chains can be established from one command receipt.
// Pipelines, substitutions, redirection and other shell programs need review.
function commandChain(raw: string): string[][] | null {
  const commands: string[][] = [[]];
  let word = "", started = false, quote = "";
  const flush = () => { if (started) commands.at(-1)!.push(word); word = ""; started = false; };
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]!;
    if (quote) {
      if (char === quote) { quote = ""; continue; }
      if (quote === '"' && /[$`]/.test(char)) return null;
      if (quote === '"' && char === "\\") {
        const next = raw[++i];
        if (next === undefined || !/["\\$`]/.test(next)) return null;
        word += next;
      } else word += char;
    } else if (char === "'" || char === '"') {
      quote = char; started = true;
    } else if (char === "\\") {
      const next = raw[++i];
      if (next === undefined || next === "\n") return null;
      word += next; started = true;
    } else if (char === "&" && raw[i + 1] === "&") {
      flush();
      if (!commands.at(-1)!.length) return null;
      commands.push([]); i++;
    } else if (/[\n\r;&|<>`$(){}*?\[\]#]/.test(char)) return null;
    else if (/\s/.test(char)) flush();
    else { word += char; started = true; }
  }
  flush();
  return quote || commands.some((args) => !args.length) ? null : commands;
}

export function verificationMethod(
  name: string, raw: unknown, workDir: string, originalWorkDir = workDir,
): VerificationMethod {
  if (["read", "edit", "write", "finish"].includes(name)) return "none";
  if (name !== "bash" || typeof raw !== "string") return "review";
  const commands = commandChain(raw.trim());
  if (!commands) return "review";
  const roots = new Set([resolve(workDir), resolve(originalWorkDir)]);
  let cwd = resolve(originalWorkDir), ranTest = false;
  for (const [command, ...args] of commands) {
    if (command === "cd") {
      const paths = args[0] === "--" ? args.slice(1) : args;
      if (paths.length !== 1 || !roots.has(resolve(cwd, paths[0]!))) return "review";
      cwd = resolve(cwd, paths[0]!);
      continue;
    }
    const runtime = basename(command!);
    if (runtime !== "node" && runtime !== "bun") {
      const reads = ["cat", "ls", "pwd", "rg", "head", "tail", "echo", "printf"];
      if (reads.includes(command!) || (command === "git" && ["status", "diff", "show"].includes(args[0] ?? ""))) continue;
      return "review";
    }
    // These options do not execute the fixture's test. Inline JS is deliberately
    // not judged by finding assertion-shaped text inside an arbitrary program.
    if (args.some((arg) => ["--check", "-c", "--version", "-v", "--help", "-h"].includes(arg))) continue;
    if (args.some((arg) => /^(?:-[ep]|--(?:eval|print))(?:=|$)/.test(arg))) return "review";
    const argv = [...args];
    if (runtime === "bun" && argv.shift() !== "test") return "review";
    const files: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i]!;
      if (arg === "--test" || arg === "--no-warnings") continue;
      if (arg === "--test-reporter") {
        if (!argv[++i] || !["tap", "spec", "dot"].includes(argv[i]!)) return "review";
        continue;
      }
      if (/^--test-reporter=(?:tap|spec|dot)$/.test(arg)) continue;
      // Selection/skipping flags and loaders could suppress or replace tests.
      if (arg.startsWith("-")) return "review";
      files.push(arg);
    }
    if (files.length !== 1 || resolve(cwd, files[0]!) !== join(cwd, "test/duration.test.cjs")) return "review";
    ranTest = true;
  }
  return ranTest ? "test" : "none";
}
