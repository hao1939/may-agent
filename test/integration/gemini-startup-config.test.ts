import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const repoRoot = resolve(import.meta.dirname, "../..");
const setupScript = resolve(repoRoot, "container/setup-gemini-config.sh");
const wrapper = resolve(repoRoot, "container/gemini-wrapper.sh");
const execute = promisify(execFile);
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("Gemini startup configuration", () => {
  test("uses the shared endpoint and grants full container permissions without persisting the key", async () => {
    const home = mkdtempSync(join(tmpdir(), "may-gemini-config-"));
    tempDirs.push(home);
    await execute("bash", [setupScript], {
      timeout: 10_000,
      env: {
        PATH: process.env.PATH,
        HOME: home,
        PROJECT_ROOT: "/workspace/example",
        MODEL_BASE_URL: "https://models.example.test/",
        MODEL_API_KEY: "must-not-be-persisted",
        GEMINI_MODEL: "gemini-test",
      },
      encoding: "utf8",
    });

    const geminiRoot = join(home, ".gemini");
    const settingsSource = readFileSync(join(geminiRoot, "settings.json"), "utf8");
    expect(settingsSource).not.toContain("must-not-be-persisted");
    expect(JSON.parse(settingsSource)).toMatchObject({
      general: { defaultApprovalMode: "auto_edit" },
      security: { folderTrust: { enabled: false }, auth: { selectedType: "gemini-api-key" } },
      context: {
        includeDirectories: ["/workspace/example"],
        loadMemoryFromIncludeDirectories: false,
        fileFiltering: { respectGitIgnore: false, respectGeminiIgnore: false },
      },
      tools: { sandbox: false, sandboxNetworkAccess: true },
      model: { name: "gemini-test" },
    });

    const policy = readFileSync(join(geminiRoot, "policies/full-access.toml"), "utf8");
    expect(policy).toContain('toolName = "*"');
    expect(policy).toContain('decision = "allow"');
    expect(policy).toContain('modes = ["plan", "default", "autoEdit", "yolo"]');
    expect(policy).toContain("allowRedirection = true");
  });

  test("the shipped command wrapper forces YOLO, trust bypass and host execution", () => {
    const source = readFileSync(wrapper, "utf8");
    expect(source).toContain('GEMINI_API_KEY="${GEMINI_API_KEY:-${MODEL_API_KEY}}"');
    expect(source).toContain('GOOGLE_GEMINI_BASE_URL="${GOOGLE_GEMINI_BASE_URL:-${MODEL_BASE_URL%/}}"');
    expect(source).toContain("/usr/local/bin/gemini-cli --yolo --skip-trust --no-sandbox");
  });
});
