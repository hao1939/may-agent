import { describe, expect, test } from "bun:test";
import aksRpE2eApp from "../../aks-rp-e2e.app/app.ts";
import evaluationApp from "../../evaluation.app/app.ts";
import mayAgentApp from "../app.ts";
import scoutKnowledgeLibApp from "../../scout-knowledge-lib.app/app.ts";

const apps = [
  ["aks-rp-e2e", aksRpE2eApp],
  ["evaluation", evaluationApp],
  ["may-agent", mayAgentApp],
  ["scout-knowledge-lib", scoutKnowledgeLibApp],
] as const;

describe("owner heartbeat manifests", () => {
  // Budget-aware intervals: may-agent uses 12h (paired with 6h platform-review = 6/day),
  // others use 4h (their schedules allocate differently).
  const expectedIntervals: Record<string, number> = {
    "aks-rp-e2e": 14_400_000,
    evaluation: 14_400_000,
    "may-agent": 43_200_000,
    "scout-knowledge-lib": 14_400_000,
  };

  for (const [id, app] of apps) {
    test(`${id} declares bounded owner heartbeat`, () => {
      const schedule = app.schedules?.find(
        (entry: { id?: string }) => entry.id === "owner-heartbeat",
      );

      expect(schedule).toMatchObject({
        enabled: true,
        intervalMs: expectedIntervals[id],
        event: {
          type: "project.owner.requested",
          project: id,
          reason: "owner-heartbeat",
        },
      });
      expect(String(schedule?.event?.params?.instruction)).toContain(
        "Low-frequency",
      );
      expect(schedule?.event?.params).toHaveProperty("reviewChecklist");
    });
  }
});
