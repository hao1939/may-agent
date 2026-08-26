import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

const repoRoot = resolve(import.meta.dirname, "../..");

describe("Herdr web terminal", () => {
  test("redirects the primary terminal route to same-origin ttyd", () => {
    const source = readFileSync(resolve(repoRoot, "packages/webui/static/pages/terminal.js"), "utf8");
    let assigned = "";
    const window = {
      location: {
        href: "http://may.example.test:8080/terminal?legacy=value#ignored",
        assign(value: string) { assigned = value; },
      },
    };
    const context = { window, URL, initTerminalPage: undefined as undefined | (() => void) };
    runInNewContext(source, context);

    context.initTerminalPage?.();

    expect(assigned).toBe("http://may.example.test:8080/terminal/");
    expect(source).not.toContain("terminalPort");
    expect(source).not.toContain("url.port");
  });

  test("uses one persistent Herdr session for the server and browser clients", () => {
    const source = readFileSync(resolve(repoRoot, "container/supervisord.conf"), "utf8");

    expect(source).toContain("[program:terminal-herdr]");
    expect(source).toContain("[program:terminal-ttyd]");
    expect(source.match(/--session may-terminal2/g)).toHaveLength(2);
    expect(source.match(/\/usr\/local\/bin\/may-herdr/g)).toHaveLength(2);
    expect(source).toContain("--base-path /terminal");
    expect(source).not.toContain("XDG_CONFIG_HOME");
    expect(source).not.toContain("MAY_TERMINAL_BRIDGE");
  });

  test("publishes the terminal only through the dashboard port", () => {
    const nginx = readFileSync(resolve(repoRoot, "container/may-agent-nginx.conf"), "utf8");
    const supervisor = readFileSync(resolve(repoRoot, "container/supervisord.conf"), "utf8");
    const compose = readFileSync(resolve(repoRoot, "container/compose.yml"), "utf8");
    const dockerfile = readFileSync(resolve(repoRoot, "container/Dockerfile"), "utf8");

    expect(nginx).toContain("listen 8080;");
    expect(nginx).toContain("location /terminal/");
    expect(nginx).toContain("proxy_pass http://127.0.0.1:7681;");
    expect(nginx).toContain("proxy_pass http://127.0.0.1:8081;");
    expect(nginx).toContain("proxy_set_header Upgrade $http_upgrade;");
    expect(supervisor).toContain("--interface 127.0.0.1 --port 7681");
    expect(supervisor).toContain('WEB_PORT="8081"');
    expect(compose).not.toContain("TERMINAL_PORT");
    expect(compose).not.toContain(":7681");
    expect(dockerfile).not.toContain("EXPOSE 7681");
  });

  test("does not load the retired browser terminal stack", () => {
    const index = readFileSync(resolve(repoRoot, "packages/webui/static/index.html"), "utf8");
    const packageJson = readFileSync(resolve(repoRoot, "package.json"), "utf8");

    expect(index).not.toContain("vendor/xterm");
    expect(packageJson).not.toContain("@xterm/");
    expect(packageJson).not.toContain("node-pty");
  });
});
