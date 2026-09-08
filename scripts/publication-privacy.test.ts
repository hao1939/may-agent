import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (file: string) => readFileSync(new URL(file, new URL("../", import.meta.url)), "utf8");
const ignored = (file: string) =>
  spawnSync("git", ["check-ignore", "--no-index", "--quiet", file], { cwd: root }).status;

describe("publication privacy", () => {
  it("ignores local credentials and overrides, but allows sanitized examples", () => {
    for (const file of [
      ".env",
      ".env.local",
      ".env.production",
      ".codex/auth.json",
      ".pi/agent/auth.json",
      ".ssh/id_ed25519",
      ".azure/accessTokens.json",
      ".aws/credentials",
      ".git-credentials",
      ".netrc",
      "container/compose.local.yml",
    ])
      expect(ignored(file)).toBe(0);
    for (const file of [".env.example", ".env.production.example"]) expect(ignored(file)).toBe(1);
  });

  it("uses image-provided CLIs and keeps private source mounts out of the example", () => {
    expect(read("container/entrypoint.sh")).not.toMatch(/\/(?:home|Users)\//);
    expect(read("container/compose.yml")).not.toContain("/app/sources/");
    expect(read("container/compose.yml")).not.toContain("GIT_CONFIG_VALUE_");
    expect(JSON.parse(read("package.json")).private).toBe(true);
  });

  it("scans before dependencies are installed and keeps fixture exceptions narrow", () => {
    const workflow = read(".github/workflows/ci.yml");
    expect(workflow.indexOf("Scan publication files")).toBeGreaterThan(0);
    expect(workflow.indexOf("Scan publication files")).toBeLessThan(workflow.indexOf("bun install"));
    expect(workflow).toContain("--redact=100");
    expect(workflow).toContain("sha256sum --check --status");
    expect(read(".gitleaks.toml")).toContain('condition = "AND"');
    expect(read(".gitleaks.toml")).toContain('regexTarget = "secret"');
  });
});
