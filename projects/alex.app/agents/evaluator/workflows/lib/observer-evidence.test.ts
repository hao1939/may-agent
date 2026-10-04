import { expect, test } from "bun:test";
import { readObserverEvidence } from "./observer-evidence.ts";

const task = {
  appTask: {
    conditions: ["42", "43"].map((resource) => ({
      id: `build-${resource}`,
      subject: `resource:${resource}`,
      expected: { source: "app:builds:observer:status" },
      observation: { state: "unknown" },
    })),
  },
};

test("reads the exact source once and scopes returned health to each awaited resource", async () => {
  const calls: unknown[] = [];
  const result = await readObserverEvidence(task, async (input) => {
    calls.push(input);
    return {
      command: "apps.list",
      apps: [
        {
          id: "builds",
          observations: [{ id: "status", type: "build.state" }],
          observerHealth: [
            {
              id: "status",
              available: true,
              lastCompletedAt: 100,
              resources: [
                { resource: "42", lastSuccessAt: 100 },
                { resource: "43", error: "bad response" },
                { resource: "unrelated", error: "not relevant" },
              ],
            },
          ],
        },
      ],
    };
  });
  expect(calls).toEqual([{ type: "apps.list", appId: "builds" }]);
  expect(result?.items[0]).toMatchObject({
    available: true,
    resource: { resource: "42", lastSuccessAt: 100 },
  });
  expect(result?.items[1]).toMatchObject({
    available: true,
    resource: { resource: "43", error: "bad response" },
  });
  expect(JSON.stringify(result)).not.toContain("unrelated");
});

test("missing, stopped, and unreadable detection remain explicit without invalidating the Task", async () => {
  for (const command of [
    async () => ({ command: "apps.list", apps: [] }),
    async () => ({ command: "apps.list", apps: [{ id: "builds" }] }),
    async () => ({
      command: "apps.list",
      apps: [
        {
          id: "builds",
          observations: [{ id: "status" }],
          observerHealth: [{ id: "status", available: false, running: false }],
        },
      ],
    }),
    async () => {
      throw new Error("host unavailable");
    },
  ]) {
    const result = await readObserverEvidence(task, command);
    expect(result?.items.every((item) => item.available === false)).toBe(true);
  }
  expect(
    await readObserverEvidence({ appTask: { conditions: [] } }, async () => {
      throw new Error("must not read");
    }),
  ).toBeUndefined();
});
