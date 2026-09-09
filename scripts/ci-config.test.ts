import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

async function resolveReleaseTag(event: string, refType: string, refName: string, input: string) {
  const image = Bun.YAML.parse(read(".github/workflows/release-image.yml")) as any;
  const script = image.jobs.publish.steps.find((step: any) => step.id === "release").run;
  const dir = mkdtempSync(join(tmpdir(), "release-tag-"));
  const output = join(dir, "output");
  try {
    const result = await promisify(execFile)("bash", ["--noprofile", "--norc", "-euo", "pipefail", "-c", script], {
      timeout: 2_000,
      env: {
        ...process.env,
        EVENT_NAME: event,
        REF_TYPE: refType,
        REF_NAME: refName,
        INPUT_TAG: input,
        GITHUB_OUTPUT: output,
      },
    }).then(
      ({ stderr }) => ({ code: 0, stderr }),
      (error) => ({ code: error.code, stderr: error.stderr }),
    );
    return { ...result, output: existsSync(output) ? readFileSync(output, "utf8") : "" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

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

  it("publishes the image when Release Please creates a release", () => {
    const release = Bun.YAML.parse(read(".github/workflows/release-please.yml")) as any;
    const image = Bun.YAML.parse(read(".github/workflows/release-image.yml")) as any;

    expect(release.jobs["release-please"].outputs).toEqual({
      release_created: "${{ steps.release.outputs.release_created }}",
      tag_name: "${{ steps.release.outputs.tag_name }}",
    });
    expect(release.jobs["release-please"].steps[0].id).toBe("release");
    expect(release.jobs["publish-image"]).toMatchObject({
      needs: "release-please",
      if: "${{ needs.release-please.outputs.release_created == 'true' }}",
      permissions: { contents: "read", packages: "write" },
      uses: "./.github/workflows/release-image.yml",
      with: { tag: "${{ needs.release-please.outputs.tag_name }}" },
    });
    expect(image.on.workflow_call.inputs.tag).toMatchObject({ required: true, type: "string" });
    expect(image.on.workflow_dispatch.inputs.tag).toMatchObject({ required: true, type: "string" });
    expect(image.on.push.tags).toEqual(["v*.*.*"]);
    const steps = image.jobs.publish.steps;
    expect(steps.find((step: any) => step.id === "release").env).toEqual({
      EVENT_NAME: "${{ github.event_name }}",
      REF_NAME: "${{ github.ref_name }}",
      REF_TYPE: "${{ github.ref_type }}",
      INPUT_TAG: "${{ inputs.tag }}",
    });
    expect(steps.find((step: any) => step.uses?.startsWith("actions/checkout@")).with.ref).toBe(
      "refs/tags/${{ steps.release.outputs.tag }}",
    );
  });

  it("selects the supplied release tag under the caller's real event context", async () => {
    // workflow_call inherits push/main or workflow_dispatch from Release Please;
    // GitHub does not change the event name to workflow_call in the callee.
    for (const [event, refType, refName, input, expected] of [
      ["push", "branch", "main", "v1.2.3", "v1.2.3"],
      ["workflow_dispatch", "branch", "main", "v1.2.3", "v1.2.3"],
      ["push", "tag", "v0.0.1", "", "v0.0.1"],
      ["workflow_dispatch", "tag", "v0.0.1", "v1.2.3", "v1.2.3"],
    ]) {
      expect(await resolveReleaseTag(event, refType, refName, input)).toEqual({
        code: 0,
        stderr: "",
        output: `tag=${expected}\n`,
      });
    }
  });

  it("rejects missing, branch-shaped and malformed tags before checkout or publication", async () => {
    for (const [event, refType, refName, input] of [
      ["push", "branch", "v1.2.3", ""],
      ["workflow_dispatch", "branch", "main", ""],
      ["push", "tag", "v1.2.3", "not-a-tag"],
      ["workflow_dispatch", "branch", "main", "v1.2.3-beta"],
      ["workflow_dispatch", "branch", "main", "v1.2.3\ntag=v9.9.9"],
      ["workflow_dispatch", "branch", "main", "v01.2.3"],
    ]) {
      expect(await resolveReleaseTag(event, refType, refName, input)).toEqual({
        code: 1,
        stderr: "Expected a semantic version tag such as v1.2.3.\n",
        output: "",
      });
    }
  });
});
