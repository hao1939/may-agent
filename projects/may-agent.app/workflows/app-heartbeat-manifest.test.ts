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

      expect(schedule).toBeDefined();
      expect(schedule?.enabled).toBe(true);
      expect(schedule?.intervalMs).toBe(expectedIntervals[id]);

      // Support both legacy `event` (singular) and new `emits` (array) formats
      const event =
        (schedule as any)?.event ??
        ((schedule as any)?.emits as unknown[])?.[0];
      expect(event).toBeDefined();

      // The event data may be flat (legacy) or nested in .data (new typed format)
      const eventData = (event as any)?.data ?? event;
      expect(eventData?.project ?? (event as any)?.target?.project).toBe(id);
      expect(event?.type ?? eventData?.type).toBe("project.owner.requested");
      expect(eventData?.reason).toBe("owner-heartbeat");

      const params = eventData?.params ?? event?.params;
      expect(String(params?.instruction)).toContain("Low-frequency");
      expect(params).toHaveProperty("reviewChecklist");
    });
  }
});
