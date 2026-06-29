import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assignTask, taskTreeConfig } from "./lib/task-tree-tools.ts";
import { execute } from "./single-spec-verifier.ts";
import {
  bindKnownWorkflowRun,
  loadSpecLoopState,
} from "./lib/spec-loop-store.ts";

const createdRoots: string[] = [];

async function makeProject() {
  const root = await mkdtemp(join(tmpdir(), "aks-single-spec-"));
  createdRoots.push(root);
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  const binDir = join(root, "bin");
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(projectDir, ".github", "workflows"), { recursive: true });
  await mkdir(join(projectDir, ".git"), { recursive: true });
  await mkdir(join(projectDir, ".github", "workflows", "feature-sets"), {
    recursive: true,
  });
  await mkdir(binDir, { recursive: true });
  await writeFile(
    join(projectDir, ".github", "workflows", "run-single-spec.yaml"),
    "name: Run Single Spec\n",
    "utf8",
  );
  await writeFile(
    join(appDir, "tasks", "tree.json"),
    `${JSON.stringify(
      {
        version: 1,
        project: "aks-rp-e2e",
        project_lifecycle: "active",
        root_task_id: "project",
        updated_at: new Date().toISOString(),
        active_task_id: null,
        active_task_ids: [],
        tasks: {
          project: {
            id: "project",
            state: "backlog",
            status: "backlog",
            children: ["verify-spec-net-integration-authorized-ip-ranges"],
            goal: "project",
            outputs: ["tasks/tree.json"],
            acceptance: ["done"],
          },
          "verify-spec-net-integration-authorized-ip-ranges": {
            id: "verify-spec-net-integration-authorized-ip-ranges",
            parent_id: "project",
            state: "backlog",
            status: "backlog",
            workflow: "single-spec-verifier",
            priority: "P1",
            children: [],
            goal: "Run one spec",
            inputs: ["spec:spec.net-integration.authorized-ip-ranges"],
            outputs: [".state/spec-loop/state.json"],
            acceptance: [
              "GitHub workflow run completed or produced a concrete blocker.",
            ],
            forbidden: [],
            conflict_scope: ["spec:spec.net-integration.authorized-ip-ranges"],
            depends_on: [],
            context: {
              specId: "spec.net-integration.authorized-ip-ranges",
              githubWorkflow: "run-single-spec.yaml",
              target: "staging",
              branch: "dev",
              timeoutMinutes: "110",
              stateRef: ".state/spec-loop/state.json",
              loopTaskId: "aks-spec-verification-loop",
            },
            trace: {},
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    join(projectDir, ".git", "config"),
    `[remote \"origin\"]\n\turl = https://ghp_exampletoken@github.com/example-org/example-repo.git\n`,
    "utf8",
  );
  const gitScript = `#!/usr/bin/env python3
import sys
if sys.argv[1:] == ["remote", "get-url", "origin"]:
    sys.stdout.write("https://ghp_exampletoken@github.com/example-org/example-repo.git\\n")
    sys.exit(0)
sys.exit(1)
`;
  const curlScript = `#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

args = sys.argv[1:]
out_path = None
if "-o" in args:
    idx = args.index("-o")
    out_path = args[idx + 1]
url = args[-1] if args else ""
log = Path(os.environ["TEST_CURL_LOG"])
with log.open("a", encoding="utf-8") as fh:
    fh.write(json.dumps(args) + "\\n")
if out_path:
    payload_hex = os.environ.get("TEST_DOWNLOAD_PAYLOAD_HEX", "")
    if payload_hex:
        payload = bytes.fromhex(payload_hex)
    elif "TEST_DOWNLOAD_PAYLOAD" in os.environ:
        payload = os.environ["TEST_DOWNLOAD_PAYLOAD"].encode("utf-8")
    else:
        payload = b"PK\x03\x04fake-zip"
    Path(out_path).write_bytes(payload)
    sys.exit(0)
if url.endswith("/dispatches"):
    raw_statuses = os.environ.get("TEST_DISPATCH_STATUSES") or os.environ.get("TEST_DISPATCH_STATUS", "204")
    raw_bodies = os.environ.get("TEST_DISPATCH_RESPONSES") or os.environ.get("TEST_DISPATCH_RESPONSE", "")
    statuses = raw_statuses.split("||") if raw_statuses else ["204"]
    bodies = raw_bodies.split("||") if raw_bodies else [""]
    counter_path = Path(os.environ["TEST_DISPATCH_COUNTER"])
    try:
        dispatch_index = int(counter_path.read_text(encoding="utf-8"))
    except Exception:
        dispatch_index = 0
    counter_path.write_text(str(dispatch_index + 1), encoding="utf-8")
    status = statuses[dispatch_index] if dispatch_index < len(statuses) else statuses[-1]
    body = bodies[dispatch_index] if dispatch_index < len(bodies) else bodies[-1]
    sys.stdout.write(body + "\\n" + status)
    sys.exit(0)
if "/actions/workflows/run-single-spec.yaml/runs" in url:
    custom_runs = os.environ.get("TEST_WORKFLOW_RUNS_JSON")
    if custom_runs:
        sys.stdout.write(json.dumps({"workflow_runs": json.loads(custom_runs)}) + "\\n200")
        sys.exit(0)
    created_at = os.environ.get("TEST_CREATED_AT", "2026-06-26T12:00:00Z")
    body = {
        "workflow_runs": [{
            "id": 123456,
            "status": "queued",
            "conclusion": None,
            "html_url": "https://github.com/example-org/example-repo/actions/runs/123456",
            "created_at": created_at,
            "display_title": os.environ.get("TEST_DISPLAY_TITLE", "Single spec: spec.net-integration.authorized-ip-ranges"),
        }]
    }
    sys.stdout.write(json.dumps(body) + "\\n200")
    sys.exit(0)
if "/actions/runs/123456/artifacts" in url:
    body = {
        "artifacts": [{
            "id": 999,
            "name": "aks-rp-e2e-123456-single-spec-test-results",
            "archive_download_url": "https://api.github.com/repos/example-org/example-repo/actions/artifacts/999/zip",
        }]
    }
    sys.stdout.write(json.dumps(body) + "\\n200")
    sys.exit(0)
if "/actions/runs/123456" in url:
    created_at = os.environ.get("TEST_CREATED_AT", "2026-06-26T12:00:00Z")
    counter_path = os.environ.get("TEST_RUN_VIEW_COUNTER")
    pending_count = int(os.environ.get("TEST_RUN_VIEW_PENDING_COUNT", "0"))
    view_index = 0
    if counter_path:
        counter = Path(counter_path)
        try:
            view_index = int(counter.read_text(encoding="utf-8"))
        except Exception:
            view_index = 0
        counter.write_text(str(view_index + 1), encoding="utf-8")
    is_pending = view_index < pending_count
    body = {
        "id": 123456,
        "status": "in_progress" if is_pending else "completed",
        "conclusion": None if is_pending else "success",
        "html_url": "https://github.com/example-org/example-repo/actions/runs/123456",
        "created_at": created_at,
        "display_title": os.environ.get("TEST_DISPLAY_TITLE", "Single spec: spec.net-integration.authorized-ip-ranges"),
    }
    sys.stdout.write(json.dumps(body) + "\\n200")
    sys.exit(0)
sys.stdout.write("{}\\n200")
`;
  const unzipScript = `#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

dest = Path(sys.argv[-1])
dest.mkdir(parents=True, exist_ok=True)
status = os.environ.get("TEST_RESULT_STATUS", "pass")
reason = os.environ.get("TEST_RESULT_REASON", "REST fallback path succeeded.")
category = os.environ.get("TEST_RESULT_CATEGORY")
spec_id = os.environ.get("TEST_RESULT_SPEC_ID", "spec.net-integration.authorized-ip-ranges")
artifact_family = os.environ.get("TEST_ARTIFACT_FAMILY", "net-integration-authorized-ip-ranges")
loop_key = os.environ.get("TEST_WORKFLOW_LOOP_KEY", "verify-spec-net-integration-authorized-ip-ranges-a_test")
(Path(os.environ["TEST_UNZIP_LOG"])).open("a", encoding="utf-8").write(str(dest) + "\\n")
(dest / "workflow-metadata.json").write_text(json.dumps({
  "loop_key": loop_key,
}, indent=2), encoding="utf-8")
artifact_dir = dest / "artifacts" / artifact_family / "spec-runner"
artifact_dir.mkdir(parents=True, exist_ok=True)
artifact_result = artifact_dir / "result.json"
artifact_result.write_text(json.dumps({
  "status": status,
  "specId": spec_id,
}, indent=2), encoding="utf-8")
artifact_ref_kind = os.environ.get("TEST_ARTIFACT_REF_KIND", "result")
artifact_ref_path = f"runs/test-results/single-{artifact_family}_123456/artifacts/{artifact_family}/spec-runner/{artifact_ref_kind}.json"
artifact_refs = [] if os.environ.get("TEST_ARTIFACT_REFS") == "empty" else [artifact_ref_path]
(dest / "result.json").write_text(json.dumps({
  "status": status,
  "specResults": [{
    "specId": spec_id,
    "status": status,
    "reason": reason,
    **({"category": category} if category else {}),
    "artifactRefs": artifact_refs
  }]
}, indent=2), encoding="utf-8")
`;
  await writeFile(join(binDir, "git"), gitScript, "utf8");
  await chmod(join(binDir, "git"), 0o755);
  await writeFile(join(binDir, "curl"), curlScript, "utf8");
  await chmod(join(binDir, "curl"), 0o755);
  await writeFile(join(binDir, "unzip"), unzipScript, "utf8");
  await chmod(join(binDir, "unzip"), 0o755);
  await writeFile(
    join(binDir, "git"),
    `#!/bin/sh
if [ "$1" = "remote" ] && [ "$2" = "get-url" ] && [ "$3" = "origin" ]; then
  echo "https://ghp_exampletoken@github.com/example-org/example-repo.git"
  exit 0
fi
echo "unexpected git call: $*" >&2
exit 1
`,
    "utf8",
  );
  await chmod(join(binDir, "git"), 0o755);
  await writeFile(
    join(binDir, "gh"),
    `#!/bin/sh
echo "gh should not be used when API token is available" >&2
exit 127
`,
    "utf8",
  );
  await chmod(join(binDir, "gh"), 0o755);
  return { appDir, projectDir, binDir };
}

function triggerText(event: Record<string, unknown>): string {
  return `## Trigger Event\n\`\`\`json\n${JSON.stringify(event)}\n\`\`\``;
}

afterEach(async () => {
  for (const root of createdRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("single-spec-verifier", () => {
  test("dispatches and classifies a workflow run via GitHub REST fallback when gh is unavailable", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const curlLog = join(appDir, ".state", "curl.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_CURL_LOG = curlLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_ATTEMPT_ID = String(assignment.attemptId);
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE = `Single spec: spec.net-integration.authorized-ip-ranges [verify-spec-net-integration.authorized-ip-ranges-${assignment.attemptId}]`;

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as pass");
      expect(result.message).toContain("REST fallback path succeeded.");
      const curlCalls = (await readFile(curlLog, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]);
      const unzipCalls = await readFile(unzipLog, "utf8");
      expect(
        curlCalls.some((args) => args[args.length - 1].includes("/dispatches")),
      ).toBeTrue();
      expect(
        curlCalls.some((args) => args[args.length - 1].includes("/artifacts")),
      ).toBeTrue();
      const dispatchCall = curlCalls.find((args) =>
        args[args.length - 1].includes("/dispatches"),
      );
      expect(dispatchCall?.join(" ")).toContain('"timeout_minutes":"110"');
      expect(unzipCalls.trim().length).toBeGreaterThan(0);

      const tree = JSON.parse(
        await readFile(join(appDir, "tasks", "tree.json"), "utf8"),
      );
      const task =
        tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
      expect(task.trace.last_worker_result).toBe("done");
      expect(task.trace.last_worker_summary).toContain("classified as pass");

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("pass");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastRunId,
      ).toBe("123456");
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_CURL_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_ATTEMPT_ID;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS;
    }
  });

  test("accepts top-level artifactRefs that only point at spec-runner status.json", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const curlLog = join(appDir, ".state", "curl.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_CURL_LOG = curlLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";
    process.env.TEST_RESULT_STATUS = "passed";
    process.env.TEST_ARTIFACT_REF_KIND = "status";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as pass");
      expect(result.message).toContain("spec-runner/status.json");
      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("pass");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastResultPath,
      ).toContain("spec-runner/status.json");
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_CURL_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_ARTIFACT_REF_KIND;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS;
    }
  });

  test("accepts empty top-level artifactRefs when result specId matches", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const curlLog = join(appDir, ".state", "curl.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_CURL_LOG = curlLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";
    process.env.TEST_RESULT_STATUS = "blocked";
    process.env.TEST_ARTIFACT_REFS = "empty";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as error");
      expect(result.message).not.toContain("artifact-routing-mismatch");

      const tree = JSON.parse(
        await readFile(join(appDir, "tasks", "tree.json"), "utf8"),
      );
      const task =
        tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
      expect(task.trace.last_worker_result).toBe("blocked");
      expect(task.trace.last_worker_summary).not.toContain(
        "artifact-routing-mismatch",
      );

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("error");
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_CURL_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_ARTIFACT_REFS;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS;
    }
  });

  test("accepts fixed-target capacity exhaustion as done", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const curlLog = join(appDir, ".state", "curl.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_CURL_LOG = curlLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";
    process.env.TEST_RESULT_STATUS = "error";
    process.env.TEST_RESULT_CATEGORY = "environment_blocker";
    process.env.TEST_RESULT_REASON =
      "Create failed with AKSCapacityHeavyUsage: Following SKUs have failed for Capacity Restrictions: standard_d4lds_v5. SkuNotAvailable in westus2.";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as done");
      expect(result.message).toContain(
        "Fixed-target staging capacity unavailable",
      );

      const tree = JSON.parse(
        await readFile(join(appDir, "tasks", "tree.json"), "utf8"),
      );
      const task =
        tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
      expect(task.trace.last_worker_result).toBe("done");

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("done");
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_CURL_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RESULT_CATEGORY;
      delete process.env.TEST_RESULT_REASON;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS;
    }
  });

  test("accepts truncated loop key family with trailing dash", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const curlLog = join(appDir, ".state", "curl.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_CURL_LOG = curlLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";
    process.env.TEST_RESULT_STATUS = "blocked";
    process.env.TEST_ARTIFACT_REFS = "empty";
    process.env.TEST_WORKFLOW_LOOP_KEY =
      "verify-spec-net-integration-authorized-ip-ranges-";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as error");
      expect(result.message).not.toContain("artifact-routing-mismatch");
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_CURL_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_ARTIFACT_REFS;
      delete process.env.TEST_WORKFLOW_LOOP_KEY;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS;
    }
  });

  test("treats runner status passed as pass", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const curlLog = join(appDir, ".state", "curl.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_CURL_LOG = curlLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";
    process.env.TEST_RESULT_STATUS = "passed";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as pass");
      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("pass");
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_CURL_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS;
    }
  });

  test("retries dispatch without loop_key when remote workflow rejects that input and still finds the run by spec title", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const curlLog = join(appDir, ".state", "curl.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_CURL_LOG = curlLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_ATTEMPT_ID = String(assignment.attemptId);
    process.env.TEST_DISPATCH_STATUSES = "422||204";
    process.env.TEST_DISPATCH_RESPONSES = `${JSON.stringify({
      message: 'Unexpected inputs provided: ["metadata"]',
      status: "422",
    })}||`;
    delete process.env.TEST_DISPATCH_STATUS;
    delete process.env.TEST_DISPATCH_RESPONSE;
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as pass");
      const curlCalls = (await readFile(curlLog, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]);
      const dispatchCalls = curlCalls.filter((args) =>
        args[args.length - 1].includes("/dispatches"),
      );
      expect(dispatchCalls.length).toBe(2);
      expect(dispatchCalls[0].join(" ")).toContain("loop_key");
      expect(dispatchCalls[1].join(" ")).not.toContain("loop_key");
      expect(dispatchCalls[0].join(" ")).toContain('"timeout_minutes":"110"');
      expect(dispatchCalls[1].join(" ")).toContain('"timeout_minutes":"110"');

      const tree = JSON.parse(
        await readFile(join(appDir, "tasks", "tree.json"), "utf8"),
      );
      const task =
        tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
      expect(task.trace.last_worker_result).toBe("done");
      expect(task.trace.last_worker_summary).toContain("classified as pass");

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastRunId,
      ).toBe("123456");
      expect((await readFile(unzipLog, "utf8")).trim().length).toBeGreaterThan(
        0,
      );
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_CURL_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_ATTEMPT_ID;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS;
    }
  });

  test("records verifier liveness heartbeat while polling workflow completion", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const curlLog = join(appDir, ".state", "curl.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    const runViewCounter = join(appDir, ".state", "run-view-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_CURL_LOG = curlLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_RUN_VIEW_COUNTER = runViewCounter;
    process.env.TEST_RUN_VIEW_PENDING_COUNT = "2";
    process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS = "10";
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      const specState =
        state.specs["spec.net-integration.authorized-ip-ranges"];
      expect(specState.lastRunId).toBe("123456");
      expect(specState.activeWorkflowRunId).toBeNull();
      expect(specState.activeTaskSessionId).toBeNull();
      expect(typeof specState.heartbeatAt).toBe("string");
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_CURL_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RESULT_SPEC_ID;
      delete process.env.TEST_ARTIFACT_FAMILY;
      delete process.env.TEST_WORKFLOW_LOOP_KEY;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS;
    }
  });

  test("bindKnownWorkflowRun records a bounded recovered run binding for later verifier ingestion", async () => {
    const { appDir, projectDir } = await makeProject();
    const { state } = loadSpecLoopState({
      appDir,
      projectDir,
      loopTaskId: "aks-spec-verification-loop",
      windowSize: 5,
    });

    bindKnownWorkflowRun(state, "spec.net-integration.authorized-ip-ranges", {
      runId: "28371054186",
      runUrl:
        "https://github.com/example-org/example-repo/actions/runs/28371054186",
      taskId:
        "repair-spec-loop-runid-binding-and-artifact-ingestion-backfill-20260629",
      attemptId:
        "a_repair-spec-loop-runid-binding-and-artifact-ingestion-backfill-20260629_test",
      taskSessionId:
        "s_task_repair-spec-loop-runid-binding-and-artifact-ingestion-backfill-20260629",
      status: "running",
    });

    const specState = state.specs["spec.net-integration.authorized-ip-ranges"];
    expect(specState.status).toBe("running");
    expect(specState.activeWorkflowRunId).toBe("28371054186");
    expect(specState.lastRunId).toBeNull();
    expect(specState.lastRunUrl).toBe(
      "https://github.com/example-org/example-repo/actions/runs/28371054186",
    );
    expect(specState.taskId).toBe(
      "repair-spec-loop-runid-binding-and-artifact-ingestion-backfill-20260629",
    );
    expect(specState.activeAttemptId).toBe(
      "a_repair-spec-loop-runid-binding-and-artifact-ingestion-backfill-20260629_test",
    );
    expect(specState.activeTaskSessionId).toBe(
      "s_task_repair-spec-loop-runid-binding-and-artifact-ingestion-backfill-20260629",
    );
  });

  test("reattaches to a known recovered workflow run from task context instead of dispatching again", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const treePath = join(appDir, "tasks", "tree.json");
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["verify-spec-net-integration.authorized-ip-ranges"];
    tree.tasks["verify-spec-net-integration-authorized-ip-ranges"].context = {
      ...tree.tasks["verify-spec-net-integration-authorized-ip-ranges"].context,
      knownWorkflowRunId: "123456",
      knownWorkflowRunUrl:
        "https://github.com/example-org/example-repo/actions/runs/123456",
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const originalPath = process.env.PATH || "";
    const curlLog = join(appDir, ".state", "curl.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const runViewCounter = join(appDir, ".state", "run-view-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_CURL_LOG = curlLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_RUN_VIEW_COUNTER = runViewCounter;
    process.env.TEST_RUN_VIEW_PENDING_COUNT = "1";
    process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS = "10";
    process.env.TEST_CREATED_AT = new Date(Date.now() - 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("Reattached existing GitHub run 123456");
      const curlCalls = (await readFile(curlLog, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]);
      expect(
        curlCalls.some((args) => args[args.length - 1].includes("/dispatches")),
      ).toBeFalse();
      expect(
        curlCalls.some((args) =>
          args[args.length - 1].includes("/actions/runs/123456"),
        ),
      ).toBeTrue();

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      const specState =
        state.specs["spec.net-integration.authorized-ip-ranges"];
      expect(specState.status).toBe("pass");
      expect(specState.lastRunId).toBe("123456");
      expect(specState.lastRunUrl).toBe(
        "https://github.com/example-org/example-repo/actions/runs/123456",
      );
      expect(specState.activeWorkflowRunId).toBeNull();
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_CURL_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS;
    }
  });

  test("reattaches to recorded active workflow run instead of dispatching again", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });
    await mkdir(join(appDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(appDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 5,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.net-integration.authorized-ip-ranges": {
              status: "running",
              taskId: "verify-spec-net-integration-authorized-ip-ranges",
              attempts: 1,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              activeAttemptId: "previous-attempt",
              activeTaskSessionId: "previous-session",
              activeWorkflowRunId: "123456",
              heartbeatAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const originalPath = process.env.PATH || "";
    const curlLog = join(appDir, ".state", "curl.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const runViewCounter = join(appDir, ".state", "run-view-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_CURL_LOG = curlLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_RUN_VIEW_COUNTER = runViewCounter;
    process.env.TEST_RUN_VIEW_PENDING_COUNT = "1";
    process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS = "10";
    process.env.TEST_CREATED_AT = new Date(Date.now() - 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("Reattached existing GitHub run 123456");
      const curlCalls = (await readFile(curlLog, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]);
      expect(
        curlCalls.some((args) => args[args.length - 1].includes("/dispatches")),
      ).toBeFalse();
      expect(
        curlCalls.some((args) => args[args.length - 1].includes("/artifacts")),
      ).toBeTrue();

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      const specState =
        state.specs["spec.net-integration.authorized-ip-ranges"];
      expect(specState.status).toBe("pass");
      expect(specState.lastRunId).toBe("123456");
      expect(specState.activeWorkflowRunId).toBeNull();
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_CURL_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS;
    }
  });

  test("polls workflow completion without blocking the daemon event loop", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const curlLog = join(appDir, ".state", "curl.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    const runViewCounter = join(appDir, ".state", "run-view-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_CURL_LOG = curlLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_RUN_VIEW_COUNTER = runViewCounter;
    process.env.TEST_RUN_VIEW_PENDING_COUNT = "3";
    process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS = "10";
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";

    try {
      let timerFired = false;
      const timer = new Promise<void>((resolve) => {
        setTimeout(() => {
          timerFired = true;
          resolve();
        }, 1);
      });
      const resultPromise = execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      await timer;
      expect(timerFired).toBeTrue();
      const result = await resultPromise;
      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as pass");
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_CURL_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RESULT_SPEC_ID;
      delete process.env.TEST_ARTIFACT_FAMILY;
      delete process.env.TEST_WORKFLOW_LOOP_KEY;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS;
    }
  });

  test("fails closed when the newest nearby workflow run is unrelated", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const curlLog = join(appDir, ".state", "curl.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_CURL_LOG = curlLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.ccp-agent.connectivity-tunnel";
    process.env.TEST_RESULT_SPEC_ID =
      "spec.net-integration.authorized-ip-ranges";
    process.env.TEST_ARTIFACT_FAMILY = "net-integration-authorized-ip-ranges";
    process.env.TEST_WORKFLOW_LOOP_KEY =
      "verify-spec-net-integration-authorized-ip-ranges-a_test";
    process.env.AKS_RP_E2E_SPEC_VERIFIER_RUN_LOOKUP_POLL_MS = "1";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("could not find the GitHub run id");
      expect(result.message).not.toContain("classified as pass");
      expect(result.message).not.toContain("run 123456");

      const curlCalls = (await readFile(curlLog, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]);
      expect(
        curlCalls.some((args) =>
          args[args.length - 1].includes(
            "/actions/workflows/run-single-spec.yaml/runs",
          ),
        ),
      ).toBeTrue();
      expect(
        curlCalls.some((args) =>
          args[args.length - 1].includes("/actions/runs/123456/artifacts"),
        ),
      ).toBeFalse();

      const tree = JSON.parse(
        await readFile(join(appDir, "tasks", "tree.json"), "utf8"),
      );
      const task =
        tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
      expect(task.trace.last_worker_result).toBe("blocked");
      expect(task.trace.last_worker_summary).toContain(
        "could not find the GitHub run id",
      );

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("error");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastRunId,
      ).toBeNull();
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastResultPath,
      ).toBeNull();
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_CURL_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RESULT_SPEC_ID;
      delete process.env.TEST_ARTIFACT_FAMILY;
      delete process.env.TEST_WORKFLOW_LOOP_KEY;
      delete process.env.TEST_WORKFLOW_RUNS_JSON;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_RUN_LOOKUP_POLL_MS;
    }
  });

  test("fails closed when several recent workflow_dispatch runs exist but none matches the requested spec or loop key", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const curlLog = join(appDir, ".state", "curl.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    const now = Date.now();
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_CURL_LOG = curlLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    await writeFile(unzipLog, "", "utf8");
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(now + 60_000).toISOString();
    process.env.TEST_WORKFLOW_RUNS_JSON = JSON.stringify([
      {
        id: 223458,
        status: "queued",
        conclusion: null,
        html_url:
          "https://github.com/example-org/example-repo/actions/runs/223458",
        created_at: new Date(now + 55_000).toISOString(),
        display_title: "Single spec: spec.jwt-authenticator.external-idp-crud",
      },
      {
        id: 223457,
        status: "queued",
        conclusion: null,
        html_url:
          "https://github.com/example-org/example-repo/actions/runs/223457",
        created_at: new Date(now + 50_000).toISOString(),
        display_title: "Single spec: spec.ccp-agent.connectivity-tunnel",
      },
      {
        id: 223456,
        status: "queued",
        conclusion: null,
        html_url:
          "https://github.com/example-org/example-repo/actions/runs/223456",
        created_at: new Date(now + 45_000).toISOString(),
        display_title: "Single spec: spec.kms.v2plus-enable-cmk-from-v2-public",
      },
    ]);
    process.env.AKS_RP_E2E_SPEC_VERIFIER_RUN_LOOKUP_POLL_MS = "1";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("could not find the GitHub run id");
      expect(result.message).not.toContain("run 223458");
      expect(result.message).not.toContain("run 223457");
      expect(result.message).not.toContain("run 223456");

      const curlCalls = (await readFile(curlLog, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]);
      expect(
        curlCalls.some((args) =>
          args[args.length - 1].includes("/actions/runs/223458"),
        ),
      ).toBeFalse();
      expect(
        curlCalls.some((args) =>
          args[args.length - 1].includes("/actions/runs/223457"),
        ),
      ).toBeFalse();
      expect(
        curlCalls.some((args) =>
          args[args.length - 1].includes("/actions/runs/223456"),
        ),
      ).toBeFalse();
      expect((await readFile(unzipLog, "utf8")).trim()).toBe("");

      const tree = JSON.parse(
        await readFile(join(appDir, "tasks", "tree.json"), "utf8"),
      );
      const task =
        tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
      expect(task.trace.last_worker_result).toBe("blocked");
      expect(task.trace.last_worker_summary).toContain(
        "could not find the GitHub run id",
      );

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("error");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastRunId,
      ).toBeNull();
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_CURL_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RESULT_SPEC_ID;
      delete process.env.TEST_ARTIFACT_FAMILY;
      delete process.env.TEST_WORKFLOW_LOOP_KEY;
      delete process.env.TEST_WORKFLOW_RUNS_JSON;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_RUN_LOOKUP_POLL_MS;
    }
  });

  test("fails closed when a newer sibling spec only shares a prefix with the requested spec id", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const curlLog = join(appDir, ".state", "curl.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    const now = Date.now();
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_CURL_LOG = curlLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    await writeFile(unzipLog, "", "utf8");
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(now + 60_000).toISOString();
    process.env.TEST_WORKFLOW_RUNS_JSON = JSON.stringify([
      {
        id: 223458,
        status: "queued",
        conclusion: null,
        html_url:
          "https://github.com/example-org/example-repo/actions/runs/223458",
        created_at: new Date(now + 55_000).toISOString(),
        display_title:
          "Single spec: spec.net-integration.authorized-ip-ranges-firewall",
      },
    ]);
    process.env.AKS_RP_E2E_SPEC_VERIFIER_RUN_LOOKUP_POLL_MS = "1";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("could not find the GitHub run id");
      expect(result.message).not.toContain("run 223458");

      const curlCalls = (await readFile(curlLog, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]);
      expect(
        curlCalls.some((args) =>
          args[args.length - 1].includes("/actions/runs/223458"),
        ),
      ).toBeFalse();
      expect((await readFile(unzipLog, "utf8")).trim()).toBe("");

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("error");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastRunId,
      ).toBeNull();
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_CURL_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RESULT_SPEC_ID;
      delete process.env.TEST_ARTIFACT_FAMILY;
      delete process.env.TEST_WORKFLOW_LOOP_KEY;
      delete process.env.TEST_WORKFLOW_RUNS_JSON;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_RUN_LOOKUP_POLL_MS;
    }
  });

  test("fails closed on non-zip GitHub auth/error artifact bodies before unzip and preserves unknown classification", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const curlLog = join(appDir, ".state", "curl.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_CURL_LOG = curlLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    await writeFile(unzipLog, "", "utf8");
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";
    process.env.TEST_DOWNLOAD_PAYLOAD = JSON.stringify({
      message: "Bad credentials",
      documentation_url: "https://docs.github.com/rest",
      status: "401",
    });

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as error");
      expect(result.message).toContain("artifact download issue:");
      expect(result.message).toContain(
        "failed validation before unzip: artifact download returned non-zip JSON; message=Bad credentials; status=401",
      );
      expect(result.message).not.toContain("missing specResults[0].specId");
      expect(result.message).not.toContain("missing loop_key");
      expect((await readFile(unzipLog, "utf8")).trim()).toBe("");

      const tree = JSON.parse(
        await readFile(join(appDir, "tasks", "tree.json"), "utf8"),
      );
      const task =
        tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
      expect(task.trace.last_worker_result).toBe("blocked");
      expect(task.trace.last_worker_summary).toContain("Bad credentials");
      expect(task.trace.last_worker_summary).toContain("status=401");

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("error");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastRunId,
      ).toBe("123456");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastResultPath,
      ).toBeNull();
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_CURL_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RESULT_SPEC_ID;
      delete process.env.TEST_ARTIFACT_FAMILY;
      delete process.env.TEST_WORKFLOW_LOOP_KEY;
      delete process.env.TEST_DOWNLOAD_PAYLOAD;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS;
    }
  });

  test("fails closed on artifact identity mismatch and records a terminal spec-loop error", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const curlLog = join(appDir, ".state", "curl.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_CURL_LOG = curlLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";
    process.env.TEST_RESULT_SPEC_ID =
      "spec.net-integration.authorized-ip-ranges-firewall";
    process.env.TEST_ARTIFACT_FAMILY =
      "net-integration-authorized-ip-ranges-firewall";
    process.env.TEST_WORKFLOW_LOOP_KEY =
      "verify-spec-net-integration-authorized-ip-ranges-firewall-a_other_attempt";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as error");
      expect(result.message).toContain("artifact-routing-mismatch");
      expect(result.message).toContain("run=123456");
      expect(result.message).toContain(
        "net-integration-authorized-ip-ranges-firewall",
      );
      expect(result.message).toContain("artifact family=");

      const tree = JSON.parse(
        await readFile(join(appDir, "tasks", "tree.json"), "utf8"),
      );
      const task =
        tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
      expect(task.trace.last_worker_result).toBe("blocked");
      expect(task.trace.last_worker_summary).toContain(
        "artifact-routing-mismatch",
      );
      expect(task.trace.last_worker_summary).toContain("run=123456");

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("error");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastRunId,
      ).toBe("123456");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastResultPath,
      ).toContain(
        "artifacts/net-integration-authorized-ip-ranges-firewall/spec-runner/result.json",
      );
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_CURL_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RESULT_SPEC_ID;
      delete process.env.TEST_ARTIFACT_FAMILY;
      delete process.env.TEST_WORKFLOW_LOOP_KEY;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.AKS_RP_E2E_SPEC_VERIFIER_POLL_MS;
    }
  });

  test("keeps error status in spec-loop state when verifier completion is blocked", async () => {
    const root = await mkdtemp(join(tmpdir(), "aks-single-spec-state-"));
    createdRoots.push(root);
    const appDir = join(root, "aks-rp-e2e.app");
    const projectDir = join(root, "aks-rp-e2e");
    mkdirSync(join(appDir, "tasks"), { recursive: true });
    mkdirSync(join(appDir, ".state", "spec-loop"), { recursive: true });
    writeFileSync(
      join(appDir, "tasks", "tree.json"),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop", "verify-spec-a"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["verify-spec-a"],
              goal: "loop",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["done"],
              conflict_scope: ["spec-loop"],
              context: {
                windowSize: 1,
                stateRef: ".state/spec-loop/state.json",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
              },
            },
            "verify-spec-a": {
              id: "verify-spec-a",
              parent_id: "aks-spec-verification-loop",
              state: "review",
              status: "review",
              workflow: "single-spec-verifier",
              priority: "P1",
              goal: "Run spec.a",
              inputs: ["spec:spec.a"],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["done"],
              conflict_scope: ["spec:spec.a"],
              context: {
                specId: "spec.a",
                githubWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                stateRef: ".state/spec-loop/state.json",
                loopTaskId: "aks-spec-verification-loop",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    writeFileSync(
      join(appDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 1,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.a": {
              status: "error",
              taskId: "verify-spec-a",
              attempts: 1,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const controllerResult = await import("./spec-loop-controller.ts").then(
      (m) =>
        m.execute({
          task: [
            `app: ${appDir}`,
            `project: ${projectDir}`,
            "agent: aks-explorer",
            "maxConcurrent: 1",
            triggerText({
              type: "project.task.completed",
              project: "aks-rp-e2e",
              taskId: "verify-spec-a",
              result: "blocked",
            }),
          ].join("\n"),
          agent: "aks-explorer",
          done: (message: string) => ({ status: "done", message }),
          escalate: (message: string) => ({ status: "escalated", message }),
          emit() {},
          dispatchEvent() {},
          runAgent: async () => ({ status: "success" }),
          summarize: () => "",
        } as any),
    );

    expect(controllerResult.status).toBe("done");
    const state = JSON.parse(
      await readFile(join(appDir, ".state", "spec-loop", "state.json"), "utf8"),
    );
    expect(state.specs["spec.a"].status).toBe("error");
  });
});
