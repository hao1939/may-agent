import { afterEach, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseMaintenanceEntries } from "./configuration.js";
import { createMaintenanceTool } from "./tool.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it("accepts named maintenance and rejects obsolete work declarations as a whole", () => {
  const entry = { name: "health", handler: "health", intervalMs: 60000 };
  expect(parseMaintenanceEntries([entry])).toEqual([entry]);
  expect(parseMaintenanceEntries([{ name: "recovery", handler: "recovery", on: ["session.end"] }])).toHaveLength(1);
  for (const invalid of [
    { ...entry, handler: { workflow: "run", task: "work" } },
    { ...entry, message: "launch an agent" },
    { ...entry, maxConcurrentTriggers: 2 },
    { ...entry, intervalMs: -1 },
    { ...entry, enabled: "yes" },
  ])
    expect(() => parseMaintenanceEntries([entry, { ...invalid, name: "invalid" }])).toThrow();
  expect(() => parseMaintenanceEntries([entry, entry])).toThrow("Duplicate");
});

it("configures the same maintenance declarations without creating infrastructure or model jobs", async () => {
  const root = mkdtempSync(join(tmpdir(), "maintenance-tool-"));
  roots.push(root);
  const configPath = join(root, "cron.json");
  const original = [{ name: "health", handler: "health", intervalMs: 60000 }];
  writeFileSync(configPath, JSON.stringify(original));
  let reloads = 0;
  let fail = false;
  const tool = createMaintenanceTool({
    configPath,
    onConfigChange: () => {
      reloads++;
      if (fail) throw new Error("rejected");
    },
  });
  expect(reloads).toBe(0);
  const invoke = (input: unknown) => tool.execute("fixture", input);
  expect((await invoke({ action: "status" })).content).toContainEqual(
    expect.objectContaining({ text: expect.stringContaining("DISABLED") }),
  );
  await expect(invoke({ action: "add", name: "work", message: "do something" })).rejects.toThrow(
    "App schedules and Tasks",
  );
  expect(JSON.parse(readFileSync(configPath, "utf8"))).toEqual(original);
  await invoke({ action: "update", name: "health", intervalMs: 120000, enabled: false });
  expect(reloads).toBe(1);
  const accepted = JSON.parse(readFileSync(configPath, "utf8"));
  expect(accepted).toEqual([{ ...original[0], intervalMs: 120000, enabled: false }]);
  fail = true;
  await expect(invoke({ action: "update", name: "health", enabled: true })).rejects.toThrow("rejected");
  expect(JSON.parse(readFileSync(configPath, "utf8"))).toEqual(accepted);
});
