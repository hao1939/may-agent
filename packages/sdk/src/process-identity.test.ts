import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { currentProcessInstance, isProcessInstanceAlive } from "./process-identity.js";

describe("process instance identity", () => {
  it("recognizes the current process instance", () => {
    expect(isProcessInstanceAlive(currentProcessInstance())).toBe(true);
  });

  it("rejects a reused current PID with a different instance identity", () => {
    expect(
      isProcessInstanceAlive({
        ...currentProcessInstance(),
        processIdentity: "previous-container-runtime",
      }),
    ).toBe(false);
  });

  it("rejects a legacy same-PID record older than the current Linux process", () => {
    if (!existsSync(`/proc/${process.pid}`)) return;
    expect(isProcessInstanceAlive({ pid: process.pid, recordedAt: "2000-01-01T00:00:00.000Z" })).toBe(false);
  });
});
