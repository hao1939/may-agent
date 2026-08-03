import { expect, test } from "bun:test";
import { legacyMayAgentTaskCloseActions } from "./unified-resource-migration";

test("closes only the fixed implemented or superseded legacy set", () => {
  const actions = legacyMayAgentTaskCloseActions();
  expect(actions).toHaveLength(6);
  expect(actions.map((action) => action.kind)).toEqual(
    Array(6).fill("close-task"),
  );
  expect(actions.slice(0, 3).map((action) => action.taskId)).toEqual([
    "ops-health-silent-recording",
    "ops-health-escalation",
    "ops-health-packet-builder",
  ]);
  expect(actions.map((action) => action.taskId)).not.toContain(
    "evidence-archive-secret-redaction",
  );
});
