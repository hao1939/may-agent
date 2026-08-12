import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

const repoRoot = resolve(import.meta.dirname, "../..");

describe("Herdr web terminal", () => {
  test("redirects the primary terminal route to the full-window ttyd service", () => {
    const source = readFileSync(resolve(repoRoot, "packages/webui/static/pages/terminal.js"), "utf8");
    let assigned = "";
    const window = {
      location: {
        href: "http://may.example.test:8080/terminal?terminalPort=9001#ignored",
        assign(value: string) { assigned = value; },
      },
    };
    const context = { window, URL, initTerminalPage: undefined as undefined | (() => void) };
    runInNewContext(source, context);

    context.initTerminalPage?.();

    expect(assigned).toBe("http://may.example.test:9001/terminal/");
  });

  test("uses one persistent Herdr session for the server and browser clients", () => {
    const source = readFileSync(resolve(repoRoot, "container/supervisord.conf"), "utf8");

    expect(source).toContain("[program:terminal-herdr]");
    expect(source).toContain("[program:terminal-ttyd]");
    expect(source.match(/--session may-terminal2/g)).toHaveLength(2);
    expect(source).toContain("--base-path /terminal");
    expect(source).not.toContain("MAY_TERMINAL_BRIDGE");
  });

  test("does not load the retired browser terminal stack", () => {
    const index = readFileSync(resolve(repoRoot, "packages/webui/static/index.html"), "utf8");
    const packageJson = readFileSync(resolve(repoRoot, "package.json"), "utf8");

    expect(index).not.toContain("vendor/xterm");
    expect(packageJson).not.toContain("@xterm/");
    expect(packageJson).not.toContain("node-pty");
  });
});
