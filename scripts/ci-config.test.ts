import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

describe("portable CI contract", () => {
  it("uses the same Bun pin for image and CI", () => {
    expect(read(".bun-version").trim()).toMatch(/^\d+\.\d+\.\d+$/);
    expect(read("container/Dockerfile")).toContain("COPY .bun-version /tmp/may-bun-version");
    expect(read(".github/workflows/ci.yml")).toContain("bun-version-file: .bun-version");
  });

  it("includes script regressions but keeps installation checks explicit", () => {
    const scripts = JSON.parse(read("package.json")).scripts;
    expect(scripts.test).toContain("scripts/");
    expect(scripts.test).not.toContain("test/deployment/");
    expect(scripts["test:deployment"]).toContain("test/deployment/");
    expect(read("test/deployment/installation.ts")).toContain("MAY_AGENT_APP_ROOT");
  });

  it("does not give PR code deployment credentials or a privileged trigger", () => {
    const workflow = read(".github/workflows/ci.yml");
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("pull_request_target");
    expect(workflow).not.toContain("secrets.");
    expect(workflow).not.toContain("push: true");
    expect(read("scripts/ci-container-smoke.sh")).not.toMatch(/--(?:volume|mount)|docker compose/);
  });

  it("configures the root package for manifest releases", () => {
    const config = JSON.parse(read("release-please-config.json"));
    const manifest = JSON.parse(read(".release-please-manifest.json"));
    const packageJson = JSON.parse(read("package.json"));

    expect(config.packages).toHaveProperty(["."]);
    expect(config["bootstrap-sha"]).toBe("dc8de24b2d5f6e328f77d2322e35ef139d6f5f0d");
    expect(manifest["."]).toBe(packageJson.version);
  });
});
