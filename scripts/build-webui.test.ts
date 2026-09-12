import { afterEach, describe, expect, it } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Web UI build", () => {
  it.each([false, true])(
    "isolates UI output (explicit output: %s) and leaves the sibling installation alone",
    async (explicit) => {
      const root = mkdtempSync(join(tmpdir(), "may-agent-ui-stage-"));
      roots.push(root);
      const repo = join(root, "host");
      mkdirSync(join(repo, "scripts"), { recursive: true });
      mkdirSync(join(repo, "packages/webui/static"), { recursive: true });
      cpSync(new URL("build-webui.ts", import.meta.url), join(repo, "scripts/build-webui.ts"));
      writeFileSync(join(repo, "packages/webui/static/index.html"), "<!DOCTYPE html><title>Synthetic UI</title>");
      const installed = join(root, "platform/ui");
      mkdirSync(installed, { recursive: true });
      writeFileSync(join(installed, "installed.txt"), "Must stay untouched");
      const target = explicit ? join(root, "release/ui") : join(repo, "bundle/platform-ui");
      mkdirSync(target, { recursive: true });
      writeFileSync(join(target, "obsolete.txt"), "Previous build output");

      const result = await promisify(execFile)(process.execPath, ["scripts/build-webui.ts"], {
        cwd: repo,
        timeout: 10_000,
        env: { ...process.env, MAY_AGENT_UI_OUTPUT_DIR: explicit ? target : "" },
      });

      expect(result.stdout).toContain(`generated ${target}`);
      expect(readFileSync(join(target, "index.html"), "utf8")).toContain("<!DOCTYPE html>");
      expect(existsSync(join(target, "obsolete.txt"))).toBe(false);
      expect(readFileSync(join(installed, "installed.txt"), "utf8")).toBe("Must stay untouched");
    },
  );
});
