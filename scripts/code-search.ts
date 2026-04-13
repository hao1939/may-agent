#!/usr/bin/env bun
/**
 * code-search.ts — Structured code search combining grep + file read + context
 *
 * Replaces the 4-step grep-then-read pattern:
 *   1. grep -rl "pattern" dir/        → find which files match
 *   2. grep -n "pattern" file.ts      → find exact lines
 *   3. grep -A10 "pattern" file.ts    → get surrounding context
 *   4. read file.ts                   → read full file for more context
 *
 * This tool does all 4 in one call, with structured output.
 *
 * Usage:
 *   bun scripts/code-search.ts <pattern> [options]
 *
 * Options:
 *   -s, --scope <dir>       Directory to search (default: .)
 *   -c, --context <n>       Lines of context around matches (default: 3)
 *   -g, --glob <pattern>    File glob filter (e.g. "*.ts", "*.md")
 *   -m, --max <n>           Max total matches to show (default: 30)
 *   -f, --max-files <n>     Max files to show (default: 15)
 *   -i, --ignore-case       Case-insensitive search
 *   -w, --word              Match whole words only
 *   -l, --files-only        List matching files only (no line content)
 *   -t, --type <ext>        File type filter (ts, md, json, etc.)
 *   --no-context            Don't show context lines (compact output)
 *   --stats                 Show match statistics summary
 *   --hidden                Include hidden files/dirs
 *   -F, --fixed             Treat pattern as fixed string, not regex
 *   -e, --exclude <dir>     Exclude directory (can repeat)
 *   --json                  Output as JSON
 *
 * Examples:
 *   bun scripts/code-search.ts "may\.db" --scope agents/ --glob "*.md" -c 2
 *   bun scripts/code-search.ts "Database" --scope src/ --type ts --stats
 *   bun scripts/code-search.ts "BUDGET|budget" -s agents/bob/ -c 5
 *   bun scripts/code-search.ts "convention_checks" -s src/ -t ts --json
 *   bun scripts/code-search.ts "heartbeat" -s agents/ -g "*.md" -l
 */

import { execSync } from "child_process";

// --- Argument parsing ---

interface Options {
  pattern: string;
  scope: string;
  context: number;
  glob?: string;
  maxMatches: number;
  maxFiles: number;
  ignoreCase: boolean;
  wordMatch: boolean;
  filesOnly: boolean;
  fileType?: string;
  noContext: boolean;
  showStats: boolean;
  includeHidden: boolean;
  fixedString: boolean;
  excludeDirs: string[];
  jsonOutput: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  const opts: Options = {
    pattern: "",
    scope: ".",
    context: 3,
    maxMatches: 30,
    maxFiles: 15,
    ignoreCase: false,
    wordMatch: false,
    filesOnly: false,
    noContext: false,
    showStats: false,
    includeHidden: false,
    fixedString: false,
    excludeDirs: [],
    jsonOutput: false,
  };

  let i = 0;
  // First non-flag argument is the pattern
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith("-")) break;
    if (!opts.pattern) {
      opts.pattern = arg;
    }
    i++;
  }

  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case "-s":
      case "--scope":
        opts.scope = args[++i];
        break;
      case "-c":
      case "--context":
        opts.context = parseInt(args[++i]) || 3;
        break;
      case "-g":
      case "--glob":
        opts.glob = args[++i];
        break;
      case "-m":
      case "--max":
        opts.maxMatches = parseInt(args[++i]) || 30;
        break;
      case "-f":
      case "--max-files":
        opts.maxFiles = parseInt(args[++i]) || 15;
        break;
      case "-i":
      case "--ignore-case":
        opts.ignoreCase = true;
        break;
      case "-w":
      case "--word":
        opts.wordMatch = true;
        break;
      case "-l":
      case "--files-only":
        opts.filesOnly = true;
        break;
      case "-t":
      case "--type":
        opts.fileType = args[++i];
        break;
      case "--no-context":
        opts.noContext = true;
        break;
      case "--stats":
        opts.showStats = true;
        break;
      case "--hidden":
        opts.includeHidden = true;
        break;
      case "-F":
      case "--fixed":
        opts.fixedString = true;
        break;
      case "-e":
      case "--exclude":
        opts.excludeDirs.push(args[++i]);
        break;
      case "--json":
        opts.jsonOutput = true;
        break;
      default:
        if (!opts.pattern && !arg.startsWith("-")) {
          opts.pattern = arg;
        }
        break;
    }
    i++;
  }

  if (!opts.pattern) {
    console.error("Error: search pattern required");
    printUsage();
    process.exit(1);
  }

  return opts;
}

function printUsage() {
  console.log(`Usage: bun scripts/code-search.ts <pattern> [options]

Options:
  -s, --scope <dir>       Directory to search (default: .)
  -c, --context <n>       Lines of context around matches (default: 3)
  -g, --glob <pattern>    File glob filter (e.g. "*.ts", "*.md")
  -m, --max <n>           Max total matches (default: 30)
  -f, --max-files <n>     Max files to show (default: 15)
  -i, --ignore-case       Case-insensitive search
  -w, --word              Whole word match
  -l, --files-only        List files only
  -t, --type <ext>        File type (ts, md, json, etc.)
  --no-context            Compact output (no context lines)
  --stats                 Show match statistics
  --hidden                Include hidden files
  -F, --fixed             Fixed string (not regex)
  -e, --exclude <dir>     Exclude directory (repeatable)
  --json                  JSON output

Examples:
  bun scripts/code-search.ts "may\\.db" -s agents/ -g "*.md" -c 2
  bun scripts/code-search.ts "Database" -s src/ -t ts --stats
  bun scripts/code-search.ts "BUDGET" -s agents/bob/ -c 5 -i`);
}

// --- Search execution ---

interface Match {
  line: number;
  text: string;
  contextBefore: string[];
  contextAfter: string[];
}

interface FileResult {
  path: string;
  matches: Match[];
  totalMatches: number;
}

interface SearchResult {
  pattern: string;
  scope: string;
  totalFiles: number;
  totalMatches: number;
  files: FileResult[];
  truncated: boolean;
  truncatedFiles?: number;
  truncatedMatches?: number;
}

function buildGrepCommand(opts: Options): string {
  // Prefer rg if available, fall back to grep
  const rgPath = "/app/.state/.gemini/tmp/bin/rg";
  const useRg = (() => {
    try {
      execSync(`test -x ${rgPath}`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();

  if (useRg) {
    return buildRgCommand(opts, rgPath);
  }
  return buildGnuGrepCommand(opts);
}

function buildRgCommand(opts: Options, rgPath: string): string {
  const parts = [rgPath, "--json"];

  if (opts.ignoreCase) parts.push("-i");
  if (opts.wordMatch) parts.push("-w");
  if (opts.fixedString) parts.push("-F");
  if (opts.context > 0 && !opts.noContext && !opts.filesOnly) {
    parts.push(`-C ${opts.context}`);
  }
  if (opts.glob) parts.push(`--glob '${opts.glob}'`);
  if (opts.fileType) parts.push(`--type-add '${opts.fileType}:*.${opts.fileType}'`, `--type ${opts.fileType}`);
  if (!opts.includeHidden) parts.push("--no-hidden");
  
  // Default exclusions
  const defaultExclude = ["node_modules", ".git", ".state"];
  const allExclude = [...defaultExclude, ...opts.excludeDirs];
  for (const dir of allExclude) {
    parts.push(`--glob '!${dir}/'`);
  }

  // Escape the pattern for shell
  const escapedPattern = opts.pattern.replace(/'/g, "'\\''");
  parts.push(`'${escapedPattern}'`);
  parts.push(opts.scope);

  return parts.join(" ");
}

function buildGnuGrepCommand(opts: Options): string {
  const parts = ["grep", "-rn", "--color=never"];

  if (opts.ignoreCase) parts.push("-i");
  if (opts.wordMatch) parts.push("-w");
  if (opts.fixedString) parts.push("-F");
  if (opts.context > 0 && !opts.noContext && !opts.filesOnly) {
    parts.push(`-C ${opts.context}`);
  }
  if (opts.glob) parts.push(`--include='${opts.glob}'`);
  if (opts.fileType) parts.push(`--include='*.${opts.fileType}'`);

  // Default exclusions
  const defaultExclude = ["node_modules", ".git", ".state"];
  const allExclude = [...defaultExclude, ...opts.excludeDirs];
  for (const dir of allExclude) {
    parts.push(`--exclude-dir='${dir}'`);
  }

  const escapedPattern = opts.pattern.replace(/'/g, "'\\''");
  parts.push(`'${escapedPattern}'`);
  parts.push(opts.scope);

  return parts.join(" ");
}

// --- Parse rg JSON output ---

function parseRgJson(output: string, opts: Options): SearchResult {
  const lines = output.split("\n").filter(Boolean);
  const fileMap = new Map<string, { matches: Match[]; totalMatches: number }>();
  let currentContext: { before: string[]; after: string[] } = { before: [], after: [] };
  let lastMatchFile: string | null = null;
  let lastMatchIdx: number = -1;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);

      if (entry.type === "match") {
        const path = entry.data.path?.text || "";
        const lineNum = entry.data.line_number || 0;
        const text = (entry.data.lines?.text || "").replace(/\n$/, "");

        if (!fileMap.has(path)) {
          fileMap.set(path, { matches: [], totalMatches: 0 });
        }
        const file = fileMap.get(path)!;
        file.totalMatches++;
        file.matches.push({
          line: lineNum,
          text,
          contextBefore: [],
          contextAfter: [],
        });
        lastMatchFile = path;
        lastMatchIdx = file.matches.length - 1;
      } else if (entry.type === "context") {
        const path = entry.data.path?.text || "";
        const text = (entry.data.lines?.text || "").replace(/\n$/, "");

        if (lastMatchFile === path && lastMatchIdx >= 0) {
          const file = fileMap.get(path)!;
          const match = file.matches[lastMatchIdx];
          const contextLineNum = entry.data.line_number || 0;

          if (contextLineNum < match.line) {
            match.contextBefore.push(text);
          } else {
            match.contextAfter.push(text);
          }
        }
      }
    } catch (e) {
      // Skip unparseable lines
    }
  }

  // Convert to result
  const allFiles: FileResult[] = [];
  let totalMatches = 0;
  let truncatedFiles = 0;
  let truncatedMatches = 0;
  let matchCount = 0;

  for (const [path, data] of fileMap) {
    totalMatches += data.totalMatches;
    if (allFiles.length >= opts.maxFiles) {
      truncatedFiles++;
      truncatedMatches += data.totalMatches;
      continue;
    }

    const limitedMatches: Match[] = [];
    for (const m of data.matches) {
      if (matchCount >= opts.maxMatches) {
        truncatedMatches++;
        continue;
      }
      limitedMatches.push(m);
      matchCount++;
    }

    allFiles.push({
      path,
      matches: limitedMatches,
      totalMatches: data.totalMatches,
    });
  }

  return {
    pattern: opts.pattern,
    scope: opts.scope,
    totalFiles: fileMap.size,
    totalMatches,
    files: allFiles,
    truncated: truncatedFiles > 0 || truncatedMatches > 0,
    ...(truncatedFiles > 0 && { truncatedFiles }),
    ...(truncatedMatches > 0 && { truncatedMatches }),
  };
}

// --- Parse GNU grep output ---

function parseGrepOutput(output: string, opts: Options): SearchResult {
  const lines = output.split("\n").filter(Boolean);
  const fileMap = new Map<string, { matches: Match[]; totalMatches: number }>();
  
  // GNU grep with context uses -- as separator between groups
  // Format: file:line:text (match) or file-line-text (context)
  let currentMatch: Match | null = null;
  let currentFile: string | null = null;

  for (const line of lines) {
    if (line === "--") {
      currentMatch = null;
      continue;
    }

    // Match line: file:linenum:text
    const matchResult = line.match(/^(.+?):(\d+):(.*)$/);
    // Context line: file-linenum-text
    const contextResult = line.match(/^(.+?)-(\d+)-(.*)$/);

    if (matchResult) {
      const [, path, lineStr, text] = matchResult;
      const lineNum = parseInt(lineStr);

      if (!fileMap.has(path)) {
        fileMap.set(path, { matches: [], totalMatches: 0 });
      }
      const file = fileMap.get(path)!;
      file.totalMatches++;

      currentMatch = {
        line: lineNum,
        text,
        contextBefore: [],
        contextAfter: [],
      };
      file.matches.push(currentMatch);
      currentFile = path;
    } else if (contextResult && currentMatch && currentFile) {
      const [, path, lineStr, text] = contextResult;
      const lineNum = parseInt(lineStr);

      if (path === currentFile) {
        if (lineNum < currentMatch.line) {
          currentMatch.contextBefore.push(text);
        } else {
          currentMatch.contextAfter.push(text);
        }
      }
    }
  }

  // Apply limits
  const allFiles: FileResult[] = [];
  let totalMatches = 0;
  let truncatedFiles = 0;
  let truncatedMatches = 0;
  let matchCount = 0;

  for (const [path, data] of fileMap) {
    totalMatches += data.totalMatches;
    if (allFiles.length >= opts.maxFiles) {
      truncatedFiles++;
      truncatedMatches += data.totalMatches;
      continue;
    }

    const limitedMatches: Match[] = [];
    for (const m of data.matches) {
      if (matchCount >= opts.maxMatches) {
        truncatedMatches++;
        continue;
      }
      limitedMatches.push(m);
      matchCount++;
    }

    allFiles.push({
      path,
      matches: limitedMatches,
      totalMatches: data.totalMatches,
    });
  }

  return {
    pattern: opts.pattern,
    scope: opts.scope,
    totalFiles: fileMap.size,
    totalMatches,
    files: allFiles,
    truncated: truncatedFiles > 0 || truncatedMatches > 0,
    ...(truncatedFiles > 0 && { truncatedFiles }),
    ...(truncatedMatches > 0 && { truncatedMatches }),
  };
}

// --- Output formatting ---

function formatResult(result: SearchResult, opts: Options): string {
  if (opts.jsonOutput) {
    return JSON.stringify(result, null, 2);
  }

  const lines: string[] = [];

  // Header
  lines.push(`🔍 Search: "${result.pattern}" in ${result.scope}`);
  lines.push(`   ${result.totalMatches} matches in ${result.totalFiles} files`);
  if (result.truncated) {
    const parts: string[] = [];
    if (result.truncatedFiles) parts.push(`${result.truncatedFiles} files omitted`);
    if (result.truncatedMatches) parts.push(`${result.truncatedMatches} matches omitted`);
    lines.push(`   ⚠️ Truncated: ${parts.join(", ")} (use -m/-f to increase limits)`);
  }
  lines.push("");

  if (opts.filesOnly) {
    // Just list files with match counts
    for (const file of result.files) {
      lines.push(`  ${file.path} (${file.totalMatches} matches)`);
    }
    return lines.join("\n");
  }

  // Detailed output per file
  for (const file of result.files) {
    lines.push(`── ${file.path} (${file.totalMatches} matches) ──`);

    for (const match of file.matches) {
      if (!opts.noContext && match.contextBefore.length > 0) {
        for (let j = 0; j < match.contextBefore.length; j++) {
          const ctxLine = match.line - match.contextBefore.length + j;
          lines.push(`  ${String(ctxLine).padStart(5)}│ ${match.contextBefore[j]}`);
        }
      }

      // The match line itself (highlighted)
      lines.push(`  ${String(match.line).padStart(5)}│ ${match.text}  ◀`);

      if (!opts.noContext && match.contextAfter.length > 0) {
        for (let j = 0; j < match.contextAfter.length; j++) {
          const ctxLine = match.line + 1 + j;
          lines.push(`  ${String(ctxLine).padStart(5)}│ ${match.contextAfter[j]}`);
        }
      }

      if (!opts.noContext) lines.push("");
    }

    if (opts.noContext) lines.push("");
  }

  // Stats summary
  if (opts.showStats) {
    lines.push("── Statistics ──");
    lines.push(`  Files with matches: ${result.totalFiles}`);
    lines.push(`  Total matches: ${result.totalMatches}`);

    // File type breakdown
    const extMap = new Map<string, number>();
    for (const file of result.files) {
      const ext = file.path.split(".").pop() || "no-ext";
      extMap.set(ext, (extMap.get(ext) || 0) + file.totalMatches);
    }
    lines.push("  By file type:");
    for (const [ext, count] of [...extMap.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`    .${ext}: ${count} matches`);
    }

    // Directory breakdown
    const dirMap = new Map<string, number>();
    for (const file of result.files) {
      const dir = file.path.split("/").slice(0, 2).join("/");
      dirMap.set(dir, (dirMap.get(dir) || 0) + file.totalMatches);
    }
    lines.push("  By directory:");
    for (const [dir, count] of [...dirMap.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`    ${dir}: ${count} matches`);
    }
  }

  return lines.join("\n");
}

// --- Main ---

function main() {
  const opts = parseArgs();
  const cmd = buildGrepCommand(opts);

  let output: string;
  try {
    output = execSync(cmd, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: 30000,
      cwd: "/app",
    });
  } catch (e: any) {
    if (e.status === 1 && !e.stdout) {
      // grep returns 1 when no matches found
      console.log(`🔍 Search: "${opts.pattern}" in ${opts.scope}`);
      console.log("   0 matches in 0 files");
      process.exit(0);
    }
    // rg/grep may exit 1 but still have output (partial results)
    output = e.stdout || "";
    if (!output) {
      console.error("Search error:", e.stderr || e.message);
      process.exit(1);
    }
  }

  // Detect if output is rg JSON or grep plain text
  const isRgJson = output.startsWith("{");
  const result = isRgJson
    ? parseRgJson(output, opts)
    : parseGrepOutput(output, opts);

  console.log(formatResult(result, opts));
}

main();
