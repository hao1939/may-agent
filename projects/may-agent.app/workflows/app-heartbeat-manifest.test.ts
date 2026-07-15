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

// Valid schedule IDs for the owner heartbeat convention.
// Most apps use "owner-heartbeat"; aks-rp-e2e evolved to "app-ops-heartbeat".
const HEARTBEAT_SCHEDULE_IDS = ["owner-heartbeat", "app-ops-heartbeat"];

describe("owner heartbeat manifests", () => {
  // Budget-aware intervals: evaluation uses a daily owner review; the other
  // apps pair owner review with their higher-frequency deterministic loops.
  const expectedIntervals: Record<string, number> = {
    "aks-rp-e2e": 14_400_000,
    evaluation: 86_400_000,
    "may-agent": 43_200_000,
    "scout-knowledge-lib": 14_400_000,
  };

  for (const [id, app] of apps) {
    test(`${id} declares bounded owner heartbeat`, () => {
      const schedule = app.schedules?.find((entry: { id?: string }) =>
        HEARTBEAT_SCHEDULE_IDS.includes(entry.id ?? ""),
      );

      expect(schedule).toBeDefined();
      expect(schedule?.enabled).toBe(true);
      expect(schedule?.intervalMs).toBe(expectedIntervals[id]);

      const event = ((schedule as any)?.emits as unknown[])?.[0] as any;
      expect(event).toBeDefined();

      const eventData = (event as any)?.data ?? event;
      expect(eventData?.project ?? (event as any)?.target?.project).toBe(id);
      const eventType = event?.type ?? eventData?.type;
      expect(eventType).toBe("project.owner.requested");
      // Reason matches the schedule ID (owner-heartbeat or app-ops-heartbeat)
      expect(HEARTBEAT_SCHEDULE_IDS.includes(eventData?.reason ?? "")).toBe(
        true,
      );

      const params = eventData?.params ?? event?.params;
      expect(String(params?.instruction).length).toBeGreaterThan(20);
      expect(params).toHaveProperty("reviewChecklist");
    });
  }
});
