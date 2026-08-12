import { expect, test } from "bun:test";
import { buildOwnerPrompt } from "./platform-owner-review.ts";

test("platform owner prompt hardens bounded evidence and typed waiting Conditions", () => {
  const prompt = buildOwnerPrompt({
    appDir: "/app/projects/may-agent.app",
    projectDir: "/app/projects/may-agent",
    packetPath: "/app/projects/may-agent.app/.state/review-packet.json",
    packetSummary: "Project: may-agent.app (status=active, owner=tech-lead)",
    taskTreePath: "/app/projects/may-agent.app/.state/tasks/tree.json",
    trigger: '## Trigger Event\n```json\n{"eventId":5037729}\n```',
    reviewArtifactPath:
      "/app/projects/may-agent.app/.state/owner-review-artifacts/event-5037729.json",
  });

  expect(prompt).toContain("Start from bounded durable evidence");
  expect(prompt).toContain(
    "Do not fall back to repository-wide search unless one exact cited file path still needs inspection",
  );
  expect(prompt).toContain("Every waiting Condition subject must be typed");
  expect(prompt).toContain("event:5011463");
  expect(prompt).toContain("pull-request:77");
  expect(prompt).toContain(
    "bare numeric ids or free-text subjects are rejected",
  );
  expect(prompt).toContain("Admission-review terminal decision gate:");
  expect(prompt).toContain(
    "the exact candidate payload, its exact runtime lineage, and any exact prior terminal closure",
  );
  expect(prompt).toContain(
    "Resolve each anchor by exact event ID, cited artifact path, or exact task/resource ID",
  );
  expect(prompt).toContain(
    "As soon as all three anchors are known, stop investigating",
  );
  expect(prompt).toContain(
    "Reserve the final quarter of the session budget for the terminal decision and finish",
  );
  expect(prompt).toContain(
    "choose the safest supported route or clarify-producer disposition instead of starting another lookup",
  );
  expect(prompt).toContain("Immediately after that checkpoint, update");
  expect(prompt).toContain(
    "before any speculative edit, broad repo search, or secondary investigation",
  );
});
