import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { writeFileSync } from "node:fs";
import { parseMaintenanceEntries, readMaintenanceEntries } from "./configuration.js";

/** Configure existing declarations; construction never starts infrastructure. */
export function createMaintenanceTool(options: {
  configPath: string;
  cronEnabled?: boolean;
  onConfigChange(): void;
}): AgentTool {
  return {
    name: "cron",
    label: "Host maintenance",
    description:
      "Inspect or enable/disable/change the interval of existing Host maintenance declarations. This does not create model jobs. Declare App work through SDK schedules and Tasks; maintain named Host handlers in cron.json. Changes reload the same registrations. Disabling timers does not disable event observations or Task recovery.",
    parameters: Type.Object({
      action: Type.Union([Type.Literal("list"), Type.Literal("status"), Type.Literal("update")]),
      name: Type.Optional(Type.String()),
      enabled: Type.Optional(Type.Boolean()),
      intervalMs: Type.Optional(Type.Number({ minimum: 10000 })),
    }),
    async execute(_id, input) {
      const text = (value: string) => ({ content: [{ type: "text" as const, text: value }], details: {} });
      const args = input as { action: string; name?: string; enabled?: boolean; intervalMs?: number };
      const previous = readMaintenanceEntries(options.configPath);
      if (args.action === "update") {
        const next = previous.map((entry) => ({ ...entry }));
        const entry = next.find((entry) => entry.name === args.name);
        if (!entry) throw new Error(`Maintenance entry ${args.name ?? "(missing name)"} not found`);
        if (args.enabled !== undefined) entry.enabled = args.enabled;
        if (args.intervalMs !== undefined) entry.intervalMs = args.intervalMs;
        parseMaintenanceEntries(next);
        writeFileSync(options.configPath, JSON.stringify(next, null, 2) + "\n");
        try {
          options.onConfigChange();
        } catch (error) {
          writeFileSync(options.configPath, JSON.stringify(previous, null, 2) + "\n");
          throw error;
        }
        return text(`Updated maintenance ${entry.name}. This does not change already admitted Tasks.`);
      }
      if (args.action !== "list" && args.action !== "status")
        throw new Error("Use list, status or update. Model jobs belong to App schedules and Tasks.");
      return text(
        [
          `Optional timers: ${options.cronEnabled ? "ENABLED" : "DISABLED"}. Event observations are independent.`,
          ...previous.map(
            (entry) =>
              `${entry.name}: ${entry.enabled === false ? "disabled" : "enabled"} · ${entry.intervalMs ? `every ${entry.intervalMs / 1000}s` : "event-only"} · ${entry.handler}`,
          ),
          ...(previous.length ? [] : ["No Host maintenance configured."]),
        ].join("\n"),
      );
    },
  };
}
