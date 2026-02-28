import { Type } from "@mariozechner/pi-ai";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "workflow-defs.d.ts");

function textResult(text: string): AgentToolResult<string> {
  return {
    content: [{ type: "text", text }],
    details: text,
  };
}

const ReadParams = Type.Object({
  path: Type.String({ description: "Absolute path to the file" }),
});

const WriteParams = Type.Object({
  path: Type.String({ description: "Absolute path to the file" }),
  content: Type.String({ description: "Content to write" }),
});

const ExecParams = Type.Object({
  command: Type.String({ description: "Shell command to execute" }),
  timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (default: 30)" })),
});

export function createReadTool(): AgentTool<typeof ReadParams> {
  return {
    name: "read",
    label: "Read File",
    description: "Read the contents of a file.",
    parameters: ReadParams,
    execute: async (_id, params) => {
      try {
        const content = readFileSync(params.path, "utf-8");
        return textResult(content);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult(`Error reading file: ${msg}`);
      }
    },
  };
}

export function createWriteTool(): AgentTool<typeof WriteParams> {
  return {
    name: "write",
    label: "Write File",
    description: "Write content to a file. Creates parent directories if needed.",
    parameters: WriteParams,
    execute: async (_id, params) => {
      try {
        mkdirSync(dirname(params.path), { recursive: true });
        writeFileSync(params.path, params.content, "utf-8");
        return textResult(`Wrote ${params.content.length} bytes to ${params.path}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult(`Error writing file: ${msg}`);
      }
    },
  };
}

export function createExecTool(cwd?: string): AgentTool<typeof ExecParams> {
  return {
    name: "exec",
    label: "Execute Command",
    description: "Execute a shell command. Returns stdout and stderr.",
    parameters: ExecParams,
    execute: async (_id, params) => {
      try {
        const timeout = (params.timeout ?? 30) * 1000;
        const output = execSync(params.command, {
          cwd: cwd ?? process.cwd(),
          encoding: "utf-8",
          timeout,
          maxBuffer: 1024 * 1024,
          stdio: ["pipe", "pipe", "pipe"],
        });
        return textResult(output || "(no output)");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "stdout" in err) {
          const e = err as { stdout: string; stderr: string; status: number };
          const output = [e.stdout, e.stderr].filter(Boolean).join("\n");
          return textResult(`Exit code ${e.status}\n${output}`);
        }
        const msg = err instanceof Error ? err.message : String(err);
        return textResult(`Error: ${msg}`);
      }
    },
  };
}

// ── Workflow validation tool ───────────────────────────────────────────

const ValidateWorkflowParams = Type.Object({
  path: Type.String({ description: "Absolute path to the workflow .ts file to validate" }),
});

/**
 * Create a tool that type-checks a workflow .ts file against the WorkflowContext types.
 *
 * The workflow file must include:
 *   /// <reference path="<path-to>/workflow-defs.d.ts" />
 *
 * If the reference directive is missing, the tool prepends it before checking
 * and reports whether the file needs it.
 */
export function createValidateWorkflowTool(): AgentTool<typeof ValidateWorkflowParams> {
  return {
    name: "validate_workflow",
    label: "Validate Workflow",
    description:
      "Type-check a workflow .ts file. Validates that the file exports " +
      "name (string), description (string), and execute (WorkflowContext => Promise<WorkflowResult>). " +
      "Returns type errors if any, or 'valid' if the file passes.",
    parameters: ValidateWorkflowParams,
    execute: async (_id, params) => {
      try {
        // Read the file first to check for reference directive
        let content: string;
        try {
          content = readFileSync(params.path, "utf-8");
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return textResult(`Error reading file: ${msg}`);
        }

        const hasRef = content.includes("/// <reference path=") && content.includes("workflow-defs.d.ts");
        let needsRefNote = "";

        if (!hasRef) {
          // Create a temp file with the reference prepended
          const refLine = `/// <reference path="${DEFS_PATH}" />\n`;
          const tmpPath = params.path + ".__validate_tmp__.ts";
          try {
            writeFileSync(tmpPath, refLine + content, "utf-8");
            const output = execSync(
              `npx tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext "${tmpPath}" 2>&1`,
              { encoding: "utf-8", timeout: 30000, cwd: dirname(params.path) },
            );
            // Clean up and report
            try { execSync(`rm -f "${tmpPath}"`, { encoding: "utf-8" }); } catch { /* ignore */ }
            needsRefNote = `Note: file is missing the reference directive. Add this line at the top:\n  /// <reference path="${DEFS_PATH}" />\n\n`;
            return textResult(needsRefNote + (output.trim() || "Valid — no type errors."));
          } catch (err: unknown) {
            try { execSync(`rm -f "${tmpPath}"`, { encoding: "utf-8" }); } catch { /* ignore */ }
            if (err && typeof err === "object" && "stdout" in err) {
              const e = err as { stdout: string; stderr: string };
              const output = [e.stdout, e.stderr].filter(Boolean).join("\n");
              // Replace tmp filename with original in error messages
              const cleaned = output.replace(new RegExp(tmpPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), params.path);
              needsRefNote = `Note: file is missing the reference directive. Add this line at the top:\n  /// <reference path="${DEFS_PATH}" />\n\n`;
              return textResult(needsRefNote + "Type errors:\n" + cleaned);
            }
            const msg = err instanceof Error ? err.message : String(err);
            return textResult(`Validation failed: ${msg}`);
          }
        }

        // File has the reference directive, validate directly
        const output = execSync(
          `npx tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext "${params.path}" 2>&1`,
          { encoding: "utf-8", timeout: 30000, cwd: dirname(params.path) },
        );
        return textResult(output.trim() || "Valid — no type errors.");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "stdout" in err) {
          const e = err as { stdout: string; stderr: string };
          const output = [e.stdout, e.stderr].filter(Boolean).join("\n");
          return textResult("Type errors:\n" + output);
        }
        const msg = err instanceof Error ? err.message : String(err);
        return textResult(`Validation failed: ${msg}`);
      }
    },
  };
}
