import { afterEach, describe, expect, it } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Web UI build", () => {
  it.each(["dev", "deployed"])("serves the selected UI through the real %s command", async (mode) => {
    const root = mkdtempSync(join(tmpdir(), "may-webui-command-"));
    roots.push(root);
    const repo = fileURLToPath(new URL("../", import.meta.url));
    const installed = join(root, "projects/platform/ui");
    mkdirSync(installed, { recursive: true });
    for (const file of ["index.html", "app.js"]) writeFileSync(join(installed, file), `Installed ${file}`);
    const child = spawn(process.execPath, mode === "dev" ? ["run", "dev"] : ["src/app/may.ts", "--web"], {
      cwd: mode === "dev" ? join(repo, "packages/webui") : repo,
      env: { ...process.env, APP_ROOT: root, PROJECT_ROOT: root, PROJECTS_ROOT: join(root, "projects"),
        STATE_DIR: join(root, ".state"), AGENTS_ROOT: join(root, "agents"), SHARED_ROOT: join(root, "shared"),
        WEB_PORT: "0", MAY_AGENT_UI_DIR: "", MAY_AGENT_UI_OUTPUT_DIR: join(root, "unused-build") },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stopped = new Promise<void>((done) => child.once("close", () => done()));
    let logs = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const baseUrl = await new Promise<string>((ready, reject) => {
        timer = setTimeout(() => reject(new Error(`Web command did not start: ${logs}`)), 10_000);
        child.once("error", reject);
        child.once("exit", (code) => reject(new Error(`Web command exited (${code}): ${logs}`)));
        child.stderr!.on("data", (chunk) => { logs += chunk.toString(); });
        child.stdout!.on("data", (chunk) => {
          logs += chunk.toString();
          const port = logs.match(/http:\/\/localhost:(\d+)/)?.[1];
          if (port) ready(`http://127.0.0.1:${port}`);
        });
      });
      const expectedRoot = mode === "dev" ? join(repo, "packages/webui/static") : installed;
      for (const [route, file] of [["/", "index.html"], ["/projects", "index.html"], ["/app.js", "app.js"]]) {
        const response = await fetch(`${baseUrl}${route}`, { signal: AbortSignal.timeout(5_000) });
        expect(response.status).toBe(200);
        expect(await response.text()).toBe(readFileSync(join(expectedRoot, file), "utf8"));
      }
      expect(existsSync(join(root, "unused-build"))).toBe(false);
      expect(readFileSync(join(installed, "index.html"), "utf8")).toBe("Installed index.html");
    } finally {
      clearTimeout(timer);
      if (child.pid) {
        try { process.kill(-child.pid, "SIGKILL"); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
      }
      await stopped;
    }
  });

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
