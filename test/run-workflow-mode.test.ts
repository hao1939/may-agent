import { describe, expect, it } from "bun:test";
import { parseRunWorkflowMode } from "../src/app/modes/run-workflow.js";

describe("run workflow mode", () => {
  it("parses workflow name and optional input", () => {
    expect(parseRunWorkflowMode(["may-agent", "--run-workflow", "may-heartbeat", "agent: may"])).toEqual({
      name: "may-heartbeat",
      input: "agent: may",
    });
  });

  it("uses empty input when omitted", () => {
    expect(parseRunWorkflowMode(["may-agent", "--run-workflow", "may-heartbeat"])).toEqual({
      name: "may-heartbeat",
      input: "",
    });
  });

  it("returns null when the mode is absent or incomplete", () => {
    expect(parseRunWorkflowMode(["may-agent", "--cron"])).toBeNull();
    expect(parseRunWorkflowMode(["may-agent", "--run-workflow"])).toBeNull();
  });
});
