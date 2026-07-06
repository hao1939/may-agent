import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseCliArgs,
  summarizeDomainCheckpoint,
} from "./domain-checkpoint.ts";

describe("domain checkpoint helper", () => {
  test("parseCliArgs supports bounded candidate path inputs", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "domain-checkpoint-"));
    const pathsFile = join(tempDir, "paths.txt");
    writeFileSync(
      pathsFile,
      [
        "# VM-only packet candidate",
        "model/knowledge-map/model.json",
        "evidence/archive/vm-prerelease-draft-promotion-batch-20260620.md",
        "",
        "evidence/archive/vm-prerelease-mixed-sku-promotion-retry-20260620.md",
      ].join("\n"),
    );

    try {
      expect(
        parseCliArgs([
          "--json",
          "--bounded-slice",
          "vmpr-maintained-seven",
          "--paths=model/knowledge-map/model.json,evidence/archive/a.md",
          "--paths",
          "evidence/archive/b.md,evidence/archive/a.md",
          "--paths-file",
          pathsFile,
        ]),
      ).toEqual({
        json: true,
        boundedSliceLabel: "vmpr-maintained-seven",
        paths: [
          "evidence/archive/a.md",
          "evidence/archive/b.md",
          "evidence/archive/vm-prerelease-draft-promotion-batch-20260620.md",
          "evidence/archive/vm-prerelease-mixed-sku-promotion-retry-20260620.md",
          "model/knowledge-map/model.json",
        ],
      });
      expect(() =>
        parseCliArgs(["--bounded-slice", "vmpr-maintained-seven"]),
      ).toThrow("--bounded-slice requires --paths or --paths-file");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("summarizeDomainCheckpoint can evaluate a bounded VM-only packet without broad dirty slices", () => {
    const taskTree = {
      tasks: {
        project: {
          id: "project",
          state: "active",
          outputs: ["model/knowledge-map/model.json"],
          conflict_scope: ["model"],
        },
        "vm-done": {
          id: "vm-done",
          state: "done",
          outputs: [
            "evidence/archive/vm-prerelease-draft-promotion-batch-20260620.md",
            "evidence/archive/vm-prerelease-mixed-sku-promotion-retry-20260620.md",
          ],
        },
        "machinespreview-blocked": {
          id: "machinespreview-blocked",
          state: "blocked",
          outputs: [
            "evidence/archive/machinespreview-owner-handoff-proof-capture-20260620.md",
          ],
        },
      },
    };

    const allChanges = [
      {
        status: "M",
        path: "model/knowledge-map/model.json",
        slice: "model",
      },
      {
        status: "??",
        path: "evidence/archive/vm-prerelease-draft-promotion-batch-20260620.md",
        slice: "evidence",
      },
      {
        status: "??",
        path: "evidence/archive/vm-prerelease-mixed-sku-promotion-retry-20260620.md",
        slice: "evidence",
      },
      {
        status: "??",
        path: "evidence/archive/machinespreview-owner-handoff-proof-capture-20260620.md",
        slice: "evidence",
      },
    ];

    const bounded = summarizeDomainCheckpoint({
      projectDir: "/tmp/aks-rp-e2e",
      taskTree,
      changes: allChanges.filter((change) =>
        [
          "model/knowledge-map/model.json",
          "evidence/archive/vm-prerelease-draft-promotion-batch-20260620.md",
          "evidence/archive/vm-prerelease-mixed-sku-promotion-retry-20260620.md",
        ].includes(change.path),
      ),
    });

    const evidenceSlice = bounded.slices.find(
      (slice) => slice.slice === "evidence",
    );
    const modelSlice = bounded.slices.find((slice) => slice.slice === "model");

    expect(evidenceSlice).toMatchObject({
      recommendation: "candidate",
      files: [
        "evidence/archive/vm-prerelease-draft-promotion-batch-20260620.md",
        "evidence/archive/vm-prerelease-mixed-sku-promotion-retry-20260620.md",
      ],
      accepted_tasks: ["vm-done"],
      blocked_tasks: [],
      active_or_review_tasks: [],
    });
    expect(modelSlice).toMatchObject({
      recommendation: "hold",
      files: ["model/knowledge-map/model.json"],
      active_or_review_tasks: ["project"],
    });
    expect(
      bounded.files.find(
        (file) =>
          file.path ===
          "evidence/archive/machinespreview-owner-handoff-proof-capture-20260620.md",
      ),
    ).toBeUndefined();
  });

  test("treats blocked-owned artifacts as hold instead of needs-planner-review", () => {
    const taskTree = {
      tasks: {
        "blocked-owner": {
          id: "blocked-owner",
          state: "blocked",
          outputs: [
            "evidence/archive/aad-rbac-managed-v2-reset-preview-bodyful-westus2-local-execute-20260619.md",
            "evidence/archive/aad-rbac-managed-v2-reset-preview-bodyful-westus2-local-execute-20260619-aad-rbac-managed-v2-lifecycle.json",
          ],
        },
        "done-owner": {
          id: "done-owner",
          state: "done",
          outputs: ["evidence/archive/done-owned.md"],
        },
      },
    };

    const summary = summarizeDomainCheckpoint({
      projectDir: "/tmp/aks-rp-e2e",
      taskTree,
      changes: [
        {
          status: "??",
          path: "evidence/archive/aad-rbac-managed-v2-reset-preview-bodyful-westus2-local-execute-20260619.md",
          slice: "evidence",
        },
        {
          status: "??",
          path: "evidence/archive/aad-rbac-managed-v2-reset-preview-bodyful-westus2-local-execute-20260619-aad-rbac-managed-v2-lifecycle.json",
          slice: "evidence",
        },
        {
          status: "??",
          path: "evidence/archive/done-owned.md",
          slice: "evidence",
        },
        {
          status: "??",
          path: "evidence/archive/unowned.md",
          slice: "evidence",
        },
      ],
    });

    const blockedMarkdown = summary.files.find((file) =>
      file.path.endsWith("preview-bodyful-westus2-local-execute-20260619.md"),
    );
    const blockedJson = summary.files.find((file) =>
      file.path.endsWith(
        "preview-bodyful-westus2-local-execute-20260619-aad-rbac-managed-v2-lifecycle.json",
      ),
    );
    const doneOwned = summary.files.find(
      (file) => file.path === "evidence/archive/done-owned.md",
    );
    const unowned = summary.files.find(
      (file) => file.path === "evidence/archive/unowned.md",
    );
    const evidenceSlice = summary.slices.find(
      (slice) => slice.slice === "evidence",
    );

    expect(blockedMarkdown).toMatchObject({
      recommendation: "hold",
      blocked_tasks: [{ id: "blocked-owner", status: "blocked" }],
      accepted_tasks: [],
    });
    expect(blockedJson).toMatchObject({
      recommendation: "hold",
      blocked_tasks: [{ id: "blocked-owner", status: "blocked" }],
      accepted_tasks: [],
    });
    expect(doneOwned).toMatchObject({
      recommendation: "candidate",
      blocked_tasks: [],
      accepted_tasks: [{ id: "done-owner", status: "done" }],
    });
    expect(unowned).toMatchObject({
      recommendation: "needs-planner-review",
      blocked_tasks: [],
      accepted_tasks: [],
    });
    expect(evidenceSlice).toMatchObject({
      recommendation: "hold",
      blocked_tasks: ["blocked-owner"],
      accepted_tasks: ["done-owner"],
    });
  });

  test("bounded sub-slice mode keeps root project exact-path ownership as non-blocking carrier", () => {
    const taskTree = {
      tasks: {
        project: {
          id: "project",
          state: "active",
          inputs: [
            "project.json",
            "model/knowledge-map/model.json",
            "model/knowledge-map/views/path-summary.json",
            "specs/index.json",
          ],
          outputs: ["model/knowledge-map/"],
        },
        "real-blocker": {
          id: "real-blocker",
          state: "blocked",
          outputs: ["model/knowledge-map/views/status-summary.json"],
        },
      },
    };

    const changes = [
      {
        status: "M",
        path: "model/knowledge-map/model.json",
        slice: "model",
      },
      {
        status: "M",
        path: "model/knowledge-map/views/path-summary.json",
        slice: "model",
      },
      {
        status: "M",
        path: "model/knowledge-map/views/status-summary.json",
        slice: "model",
      },
    ];

    const unbounded = summarizeDomainCheckpoint({
      projectDir: "/tmp/aks-rp-e2e",
      taskTree,
      changes,
    });
    const bounded = summarizeDomainCheckpoint({
      projectDir: "/tmp/aks-rp-e2e",
      taskTree,
      changes: changes.slice(0, 2),
      boundedSliceLabel: "model:vmpr-maintained-seven",
    });

    expect(
      unbounded.files.find(
        (file) => file.path === "model/knowledge-map/model.json",
      ),
    ).toMatchObject({
      recommendation: "hold",
      active_or_review_tasks: [
        { id: "project", status: "active", matched_by: ["path"] },
      ],
      carrier_tasks: [],
    });
    expect(
      bounded.files.find(
        (file) => file.path === "model/knowledge-map/model.json",
      ),
    ).toMatchObject({
      slice: "model:vmpr-maintained-seven",
      recommendation: "candidate",
      active_or_review_tasks: [],
      carrier_tasks: [
        { id: "project", status: "active", matched_by: ["path"] },
      ],
    });
    expect(
      bounded.files.find(
        (file) => file.path === "model/knowledge-map/views/path-summary.json",
      ),
    ).toMatchObject({
      slice: "model:vmpr-maintained-seven",
      recommendation: "candidate",
      active_or_review_tasks: [],
      carrier_tasks: [
        { id: "project", status: "active", matched_by: ["path"] },
      ],
    });
    expect(
      bounded.slices.find(
        (slice) => slice.slice === "model:vmpr-maintained-seven",
      ),
    ).toMatchObject({
      recommendation: "candidate",
      active_or_review_tasks: [],
      blocked_tasks: [],
      carrier_tasks: ["project"],
      files: [
        "model/knowledge-map/model.json",
        "model/knowledge-map/views/path-summary.json",
      ],
    });
    expect(
      summarizeDomainCheckpoint({
        projectDir: "/tmp/aks-rp-e2e",
        taskTree,
        changes,
        boundedSliceLabel: "model:vmpr-maintained-seven",
      }).files.find(
        (file) => file.path === "model/knowledge-map/views/status-summary.json",
      ),
    ).toMatchObject({
      slice: "model:vmpr-maintained-seven",
      recommendation: "hold",
      blocked_tasks: [
        { id: "real-blocker", status: "blocked", matched_by: ["path"] },
      ],
    });
  });

  test("bounded sub-slice mode treats the currently executing checkpoint task as a non-blocking carrier", () => {
    const taskTree = {
      tasks: {
        "checkpoint-virtualmachines-mixed-sku-source-authority-slice-20260705":
          {
            id: "checkpoint-virtualmachines-mixed-sku-source-authority-slice-20260705",
            state: "active",
            conflict_scope: [
              "repo-hygiene:domain-unpublished-change",
              "feature:virtualmachines-agentpool",
            ],
          },
      },
    };

    const changes = [
      {
        status: "M",
        path: "features/virtualmachines-agentpool/specs/virtualmachines-mixed-sku-rest-scale.json",
        slice: "feature:virtualmachines-agentpool",
      },
      {
        status: "M",
        path: "features/virtualmachines-agentpool/tests/virtualmachines-mixed-sku-rest-scale.ts",
        slice: "feature:virtualmachines-agentpool",
      },
    ];

    const unbounded = summarizeDomainCheckpoint({
      projectDir: "/tmp/aks-rp-e2e",
      taskTree,
      changes,
    });
    const bounded = summarizeDomainCheckpoint({
      projectDir: "/tmp/aks-rp-e2e",
      taskTree,
      changes,
      boundedSliceLabel:
        "checkpoint-virtualmachines-mixed-sku-source-authority-slice-20260705",
    });

    expect(
      unbounded.files.find(
        (file) =>
          file.path ===
          "features/virtualmachines-agentpool/specs/virtualmachines-mixed-sku-rest-scale.json",
      ),
    ).toMatchObject({
      recommendation: "hold",
      active_or_review_tasks: [
        {
          id: "checkpoint-virtualmachines-mixed-sku-source-authority-slice-20260705",
          status: "active",
          matched_by: ["scope"],
        },
      ],
      carrier_tasks: [],
    });
    expect(
      bounded.files.find(
        (file) =>
          file.path ===
          "features/virtualmachines-agentpool/specs/virtualmachines-mixed-sku-rest-scale.json",
      ),
    ).toMatchObject({
      recommendation: "candidate",
      active_or_review_tasks: [],
      carrier_tasks: [
        {
          id: "checkpoint-virtualmachines-mixed-sku-source-authority-slice-20260705",
          status: "active",
          matched_by: ["scope"],
        },
      ],
    });
    expect(
      bounded.slices.find(
        (slice) => slice.slice === "feature:virtualmachines-agentpool",
      ),
    ).toMatchObject({
      recommendation: "candidate",
      active_or_review_tasks: [],
      blocked_tasks: [],
      carrier_tasks: [
        "checkpoint-virtualmachines-mixed-sku-source-authority-slice-20260705",
      ],
      files: [
        "features/virtualmachines-agentpool/specs/virtualmachines-mixed-sku-rest-scale.json",
        "features/virtualmachines-agentpool/tests/virtualmachines-mixed-sku-rest-scale.ts",
      ],
    });
  });

  test("recognizes derived knowledge-map package slices independently from global model", () => {
    const taskTree = {
      tasks: {
        "done-derived-slice": {
          id: "done-derived-slice",
          state: "done",
          outputs: [
            "model/knowledge-map/derived/test-slice/derived-package.json",
          ],
          conflict_scope: ["model-derived:test-slice"],
        },
        "active-global-model": {
          id: "active-global-model",
          state: "active",
          outputs: ["model/knowledge-map/model.json"],
          conflict_scope: ["model"],
        },
      },
    };

    const summary = summarizeDomainCheckpoint({
      projectDir: "/tmp/aks-rp-e2e",
      taskTree,
      changes: [
        {
          status: "??",
          path: "model/knowledge-map/derived/test-slice/derived-package.json",
          slice: "model-derived:test-slice",
        },
        {
          status: "??",
          path: "model/knowledge-map/derived/test-slice/path-summary.json",
          slice: "model-derived:test-slice",
        },
        {
          status: "??",
          path: "model/knowledge-map/model.json",
          slice: "model",
        },
      ],
    });

    const derivedManifest = summary.files.find(
      (file) =>
        file.path ===
        "model/knowledge-map/derived/test-slice/derived-package.json",
    );
    const derivedPathSummary = summary.files.find(
      (file) =>
        file.path ===
        "model/knowledge-map/derived/test-slice/path-summary.json",
    );
    const globalModel = summary.files.find(
      (file) => file.path === "model/knowledge-map/model.json",
    );
    const derivedSlice = summary.slices.find(
      (slice) => slice.slice === "model-derived:test-slice",
    );
    const globalSlice = summary.slices.find((slice) => slice.slice === "model");

    expect(derivedManifest).toMatchObject({
      recommendation: "candidate",
      active_or_review_tasks: [],
      accepted_tasks: [{ id: "done-derived-slice", status: "done" }],
    });
    expect(derivedPathSummary).toMatchObject({
      recommendation: "candidate",
      active_or_review_tasks: [],
      accepted_tasks: [{ id: "done-derived-slice", status: "done" }],
    });
    expect(globalModel).toMatchObject({
      recommendation: "hold",
      active_or_review_tasks: [{ id: "active-global-model", status: "active" }],
    });
    expect(derivedSlice).toMatchObject({
      recommendation: "candidate",
      accepted_tasks: ["done-derived-slice"],
      active_or_review_tasks: [],
    });
    expect(globalSlice).toMatchObject({
      recommendation: "hold",
      active_or_review_tasks: ["active-global-model"],
    });
  });

  test("ignores scope-only historical blocked holders when they no longer declare the exact file", () => {
    const taskTree = {
      tasks: {
        "historical-blocked": {
          id: "historical-blocked",
          state: "blocked",
          blocker:
            "Historical/superseded blocker only: do not resume this old route.",
          conflict_scope: ["feature:app-routing"],
          outputs: ["evidence/archive/old-note.md"],
        },
        "done-owner": {
          id: "done-owner",
          state: "done",
          outputs: ["specs/app-routing-custom-domain-ingress.json"],
        },
      },
    };

    const summary = summarizeDomainCheckpoint({
      projectDir: "/tmp/aks-rp-e2e",
      taskTree,
      changes: [
        {
          status: "M",
          path: "specs/app-routing-custom-domain-ingress.json",
          slice: "spec:app-routing-custom-domain-ingress",
        },
      ],
    });

    const specFile = summary.files.find(
      (file) => file.path === "specs/app-routing-custom-domain-ingress.json",
    );
    const specSlice = summary.slices.find(
      (slice) => slice.slice === "spec:app-routing-custom-domain-ingress",
    );

    expect(specFile).toMatchObject({
      recommendation: "candidate",
      blocked_tasks: [],
      accepted_tasks: [{ id: "done-owner", status: "done" }],
    });
    expect(specSlice).toMatchObject({
      recommendation: "candidate",
      blocked_tasks: [],
      accepted_tasks: ["done-owner"],
    });
  });

  test("derives exact spec-level signals for feature-rooted workload-identity specs and tests", () => {
    const projectDir = mkdtempSync(
      join(tmpdir(), "domain-checkpoint-feature-rooted-"),
    );

    try {
      mkdirSync(join(projectDir, "features/workload-identity/specs"), {
        recursive: true,
      });
      mkdirSync(join(projectDir, "features/workload-identity/tests"), {
        recursive: true,
      });
      writeFileSync(
        join(
          projectDir,
          "features/workload-identity/specs/workload-identity-no-oidc-negative.json",
        ),
        JSON.stringify({
          id: "spec.workload-identity.no-oidc-negative",
          featureId: "workload-identity-public-api-create",
          featurePathIds: ["path.workload-identity.no-oidc-negative"],
          probeRef:
            "features/workload-identity/tests/workload-identity-no-oidc-negative.ts",
        }),
      );
      writeFileSync(
        join(
          projectDir,
          "features/workload-identity/specs/workload-identity-runtime-token-projection-windows.json",
        ),
        JSON.stringify({
          id: "spec.workload-identity.runtime-token-projection-windows",
          featureId: "workload-identity-runtime-token-projection-windows",
          featurePathIds: [
            "path.workload-identity.runtime-token-projection-windows.staging-pass",
          ],
          probeRef:
            "features/workload-identity/tests/workload-identity-runtime-token-projection-windows.ts",
        }),
      );
      writeFileSync(
        join(
          projectDir,
          "features/workload-identity/tests/workload-identity-no-oidc-negative.ts",
        ),
        "export {};\n",
      );
      writeFileSync(
        join(
          projectDir,
          "features/workload-identity/tests/workload-identity-runtime-token-projection-windows.ts",
        ),
        "export {};\n",
      );

      const taskTree = {
        tasks: {
          "no-oidc-holder": {
            id: "no-oidc-holder",
            state: "blocked",
            conflict_scope: ["spec:spec.workload-identity.no-oidc-negative"],
          },
          "windows-done": {
            id: "windows-done",
            state: "done",
            conflict_scope: [
              "spec:spec.workload-identity.runtime-token-projection-windows",
            ],
          },
        },
      };

      const summary = summarizeDomainCheckpoint({
        projectDir,
        taskTree,
        changes: [
          {
            status: "M",
            path: "features/workload-identity/specs/workload-identity-no-oidc-negative.json",
            slice: "feature:workload-identity",
          },
          {
            status: "M",
            path: "features/workload-identity/tests/workload-identity-no-oidc-negative.ts",
            slice: "feature:workload-identity",
          },
          {
            status: "M",
            path: "features/workload-identity/specs/workload-identity-runtime-token-projection-windows.json",
            slice: "feature:workload-identity",
          },
          {
            status: "M",
            path: "features/workload-identity/tests/workload-identity-runtime-token-projection-windows.ts",
            slice: "feature:workload-identity",
          },
        ],
      });

      expect(
        summary.files.find(
          (file) =>
            file.path ===
            "features/workload-identity/specs/workload-identity-no-oidc-negative.json",
        ),
      ).toMatchObject({
        recommendation: "hold",
        blocked_tasks: [
          {
            id: "no-oidc-holder",
            status: "blocked",
            matched_by: ["scope"],
          },
        ],
      });
      expect(
        summary.files.find(
          (file) =>
            file.path ===
            "features/workload-identity/tests/workload-identity-no-oidc-negative.ts",
        ),
      ).toMatchObject({
        recommendation: "hold",
        blocked_tasks: [
          {
            id: "no-oidc-holder",
            status: "blocked",
            matched_by: ["scope"],
          },
        ],
      });
      expect(
        summary.files.find(
          (file) =>
            file.path ===
            "features/workload-identity/specs/workload-identity-runtime-token-projection-windows.json",
        ),
      ).toMatchObject({
        recommendation: "candidate",
        blocked_tasks: [],
        accepted_tasks: [
          {
            id: "windows-done",
            status: "done",
            matched_by: ["scope"],
          },
        ],
      });
      expect(
        summary.files.find(
          (file) =>
            file.path ===
            "features/workload-identity/tests/workload-identity-runtime-token-projection-windows.ts",
        ),
      ).toMatchObject({
        recommendation: "candidate",
        blocked_tasks: [],
        accepted_tasks: [
          {
            id: "windows-done",
            status: "done",
            matched_by: ["scope"],
          },
        ],
      });
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("resolves accepted ownership from archived done-leaf tasks", () => {
    const taskTree = {
      tasks: {
        project: {
          id: "project",
          state: "active",
          outputs: ["tasks/tree.json"],
        },
      },
    };

    const summary = summarizeDomainCheckpoint({
      projectDir: "/tmp/aks-rp-e2e",
      taskTree,
      archivedTasks: [
        {
          id: "archived-row35-owner",
          state: "done",
          outputs: [
            "../aks-rp-e2e/evidence/archive/vm-prerelease-post-row35-checkpoint-helper-rerun-20260620.md",
          ],
        },
        {
          id: "archived-row25-owner",
          state: "done",
          outputs: [
            "../aks-rp-e2e/evidence/archive/vm-prerelease-row25-live-replay-implementation-20260620.md",
          ],
        },
      ],
      changes: [
        {
          status: "??",
          path: "evidence/archive/vm-prerelease-post-row35-checkpoint-helper-rerun-20260620.md",
          slice: "evidence",
        },
        {
          status: "??",
          path: "evidence/archive/vm-prerelease-row25-live-replay-implementation-20260620.md",
          slice: "evidence",
        },
      ],
    });

    const row35 = summary.files.find(
      (file) =>
        file.path ===
        "evidence/archive/vm-prerelease-post-row35-checkpoint-helper-rerun-20260620.md",
    );
    const row25 = summary.files.find(
      (file) =>
        file.path ===
        "evidence/archive/vm-prerelease-row25-live-replay-implementation-20260620.md",
    );
    const evidenceSlice = summary.slices.find(
      (slice) => slice.slice === "evidence",
    );

    expect(row35).toMatchObject({
      recommendation: "candidate",
      accepted_tasks: [{ id: "archived-row35-owner", status: "done" }],
      blocked_tasks: [],
      active_or_review_tasks: [],
    });
    expect(row25).toMatchObject({
      recommendation: "candidate",
      accepted_tasks: [{ id: "archived-row25-owner", status: "done" }],
      blocked_tasks: [],
      active_or_review_tasks: [],
    });
    expect(evidenceSlice).toMatchObject({
      recommendation: "candidate",
      accepted_tasks: ["archived-row25-owner", "archived-row35-owner"],
      blocked_tasks: [],
      active_or_review_tasks: [],
      files: [
        "evidence/archive/vm-prerelease-post-row35-checkpoint-helper-rerun-20260620.md",
        "evidence/archive/vm-prerelease-row25-live-replay-implementation-20260620.md",
      ],
    });
  });
});
