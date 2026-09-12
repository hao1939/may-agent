import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EventBus } from "../core/events/bus.js";
import { describe, expect, it, spyOn } from "bun:test";
import { parseRunWorkflowMode, runWorkflowMode } from "./run-workflow.js";

describe("run workflow mode", () => {
  it.each(["task", "standalone"])(
    "dry-run inspects a %s workflow without invoking its effects or result",
    async (kind) => {
      const root = mkdtempSync(join(tmpdir(), "may-workflow-preview-"));
      const messages: string[] = [];
      const log = spyOn(console, "log").mockImplementation((message) => {
        messages.push(String(message));
      });
      try {
        const agentsRoot = join(root, "agents");
        const dir = join(agentsRoot, "sample", "workflows");
        const marker = join(root, "executed");
        mkdirSync(dir, { recursive: true });
        writeFileSync(
          join(dir, "preview.ts"),
          `
        import { writeFileSync } from "node:fs";
        export const name = "preview";
        export const description = "Inspect this definition";
        export async function execute(ctx) {
          writeFileSync(${JSON.stringify(marker)}, "unexpected effect");
          return ${kind === "task" ? '{ state: "converged", summary: "Answer", facts: [] }' : 'ctx.done("Answer")'};
        }
      `,
        );
        await runWorkflowMode({
          mode: { name: "preview", input: "inspect" },
          dryRun: true,
          agentsRoot,
          sharedRoot: join(root, "shared"),
          projectsRoot: join(root, "projects"),
          projectRoot: root,
          persistDir: join(root, "state"),
          bus: new EventBus(),
          manager: {} as any,
        });
        expect(existsSync(marker)).toBe(false);
        expect(existsSync(join(root, "state"))).toBe(false);
        expect(messages).toContain("Workflow: preview");
        expect(messages).toContain("Inspect this definition");
        expect(messages).toContain("Dry run: definition inspected; workflow, tools and agents were not executed.");
        expect(messages.join("\n")).not.toContain("Result: undefined");
      } finally {
        log.mockRestore();
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it("parses workflow name and optional input", () => {
    expect(parseRunWorkflowMode(["may-agent", "--run-workflow", "may-heartbeat", "agent: may"])).toEqual({
      name: "may-heartbeat",
      input: "agent: may",
    });
  });

  it("uses empty input when omitted", () => {
    expect(parseRunWorkflowMode(["may-agent", "--run-workflow", "may-heartbeat"])).toEqual({
      name: "may-heartbeat",
      input: "",
    });
  });

  it("returns null when the mode is absent or incomplete", () => {
    expect(parseRunWorkflowMode(["may-agent", "--cron"])).toBeNull();
    expect(parseRunWorkflowMode(["may-agent", "--run-workflow"])).toBeNull();
  });
});
