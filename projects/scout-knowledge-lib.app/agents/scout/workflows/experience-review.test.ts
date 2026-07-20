import { describe, expect, it } from "bun:test";
import {
  boundedEvidenceText,
  buildExperienceReviewPacket,
  experiencePacketPrompt,
  isExperienceReviewTask,
} from "./experience-review";

function queryWith(rows: Array<Record<string, unknown>>, truncated = false) {
  let received: Record<string, unknown> | undefined;
  return {
    query: {
      events(filter: Record<string, unknown>) {
        received = filter;
        return {
          rows,
          rowCount: rows.length,
          limit: 200,
          truncated,
        };
      },
    },
    received: () => received,
  };
}

function reconciled(
  id: number,
  taskId: string,
  disposition: string,
  timestamp: number,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    event_type: "project.task.reconciled",
    project_id: "scout-knowledge-lib",
    task_id: taskId,
    handler: "workflow:scout-explore",
    timestamp,
    data: JSON.stringify({ disposition, ...extra }),
  };
}

describe("Scout experience-review packet", () => {
  it("queries one project over an overlapping 36-hour window", () => {
    const now = 200_000_000;
    const harness = queryWith([]);

    const packet = buildExperienceReviewPacket(harness.query as never, now);

    expect(harness.received()).toEqual({
      type: "project.task.reconciled",
      projectId: "scout-knowledge-lib",
      since: now - 36 * 60 * 60_000,
      until: now,
      limit: 200,
    });
    expect(packet).toMatchObject({
      available: true,
      ready: true,
      readiness: "complete",
      projectId: "scout-knowledge-lib",
      rowCount: 0,
      groups: [],
    });
  });

  it("groups only exact task, handler, and disposition facts", () => {
    const rows = [
      reconciled(3, "explore-hn", "converged", 300, {
        summary: "No new item",
        acceptanceBasis: {
          method: "workflow-contract",
          evidence: ["feed:https://example.test/top?token=secret"],
        },
      }),
      reconciled(2, "explore-hn", "converged", 200, {
        summary: "No new item",
        actionsApplied: ["updated improve-source-check"],
      }),
      reconciled(1, "explore-hn", "attention", 100, {
        summary: "source unavailable",
      }),
    ];

    const packet = buildExperienceReviewPacket(
      queryWith(rows).query as never,
      500,
    );

    expect(packet.groups).toHaveLength(2);
    expect(packet.groups?.[1]).toMatchObject({
      taskId: "explore-hn",
      handler: "workflow:scout-explore",
      disposition: "converged",
      occurrences: 2,
      firstAt: "1970-01-01T00:00:00.200Z",
      lastAt: "1970-01-01T00:00:00.300Z",
      eventIds: [3, 2],
      summaries: ["No new item"],
      actions: ["updated improve-source-check"],
      acceptanceMethods: ["workflow-contract"],
    });
    expect(packet.groups?.[1]?.evidence[0]).toBe(
      "feed:https://example.test/top",
    );
    expect(packet.groups?.[0]).toMatchObject({
      disposition: "attention",
      occurrences: 1,
    });
  });

  it("bounds groups from a complete source result", () => {
    const rows = Array.from({ length: 24 }, (_, index) =>
      reconciled(index + 1, `task-${index}`, "converged", index + 1),
    );

    const packet = buildExperienceReviewPacket(
      queryWith(rows).query as never,
      100,
    );

    expect(packet.groups).toHaveLength(16);
    expect(packet.omittedGroups).toBe(8);
  });

  it("does not expose truncated history as learning evidence", () => {
    const rows = Array.from({ length: 24 }, (_, index) =>
      reconciled(index + 1, `task-${index}`, "converged", index + 1),
    );

    const packet = buildExperienceReviewPacket(
      queryWith(rows, true).query as never,
      100,
    );

    expect(packet).toMatchObject({
      available: true,
      ready: false,
      readiness: "source-truncated",
      sourceTruncated: true,
      rowCount: 24,
    });
    expect(packet.groups).toBeUndefined();
    expect(experiencePacketPrompt(packet)).toContain(
      "Continue as an ordinary owner review",
    );
  });

  it("does not expose incorrectly scoped rows as learning evidence", () => {
    const wrongProject = {
      ...reconciled(1, "explore-hn", "converged", 100),
      project_id: "another-project",
    };

    const packet = buildExperienceReviewPacket(
      queryWith([wrongProject]).query as never,
      500,
    );

    expect(packet).toMatchObject({
      available: true,
      ready: false,
      readiness: "scope-mismatch",
      unexpectedRows: 1,
    });
    expect(packet.groups).toBeUndefined();
  });

  it("redacts credential-like values and bounds text", () => {
    const text = boundedEvidenceText(
      "authorization: Bearer-secret https://example.test/path?xsec_token=abc " +
        "x".repeat(400),
      100,
    );

    expect(text).toContain("authorization=[redacted]");
    expect(text).toContain("https://example.test/path");
    expect(text).not.toContain("Bearer-secret");
    expect(text).not.toContain("xsec_token");
    expect(text.length).toBeLessThanOrEqual(101);
  });

  it("degrades to an unavailable packet when history cannot be queried", () => {
    const packet = buildExperienceReviewPacket(
      {
        events() {
          throw new Error("database token=secret unavailable");
        },
      } as never,
      100,
    );

    expect(packet).toMatchObject({
      available: false,
      ready: false,
      readiness: "unavailable",
      error: "database token=[redacted] unavailable",
    });
    expect(experiencePacketPrompt(packet)).toContain("ordinary owner review");
  });

  it("recognizes only the explicit experience-review trigger", () => {
    expect(
      isExperienceReviewTask(
        'task\n## Trigger Event\n```json\n{"reason":"experience-review"}\n```',
      ),
    ).toBe(true);
    expect(
      isExperienceReviewTask(
        'task\n## Trigger Event\n```json\n{"reason":"library-health-signal"}\n```',
      ),
    ).toBe(false);
  });
});
