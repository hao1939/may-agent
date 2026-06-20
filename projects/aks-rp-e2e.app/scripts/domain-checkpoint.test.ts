import { describe, expect, test } from "bun:test";
import { summarizeDomainCheckpoint } from "./domain-checkpoint.ts";

describe("domain checkpoint helper", () => {
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
});
