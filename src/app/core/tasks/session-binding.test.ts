import { describe, expect, it } from "bun:test";
import { appTaskSessionBinding } from "./session-binding.js";

describe("App Task session binding", () => {
  it("accepts only an explicit typed binding", () => {
    expect(
      appTaskSessionBinding({
        appId: "may.app",
        taskId: "conversation/example",
        generation: 3,
        attemptId: "attempt-1",
      }),
    ).toEqual({ appId: "may", taskId: "conversation/example", generation: 3 });
  });

  it("does not reconstruct ownership from prompt text", () => {
    expect(
      appTaskSessionBinding(
        '## Reconciliation Task\n```json\n{"appId":"may","taskId":"conversation/example","generation":3}\n```',
      ),
    ).toBeNull();
  });
});
