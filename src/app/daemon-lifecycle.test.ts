import { describe, expect, it } from "bun:test";
import { startSupervisorRestarter } from "./daemon-lifecycle.js";

describe("startSupervisorRestarter", () => {
  it("hands restart ownership to supervisor's one-shot restarter", () => {
    const emitted: unknown[] = [];
    const calls: unknown[] = [];

    startSupervisorRestarter({ emit: (event) => emitted.push(event) }, ((file, args, options, callback) => {
      calls.push({ file, args, options });
      callback(null, "may-agent-restarter: started", "");
    }) as any);

    expect(calls).toEqual([
      {
        file: "supervisorctl",
        args: ["start", "may-agent-restarter"],
        options: { timeout: 10000 },
      },
    ]);
    expect(emitted).toEqual([]);
  });

  it("emits an info event when supervisor rejects the restarter start", () => {
    const emitted: unknown[] = [];

    startSupervisorRestarter({ emit: (event) => emitted.push(event) }, ((_file, _args, _options, callback) => {
      callback(new Error("start failed"), "", "may-agent-restarter: ERROR (already started)");
    }) as any);

    expect(emitted).toEqual([
      {
        type: "info",
        message: "[restart] Failed to start supervisor restarter: may-agent-restarter: ERROR (already started)",
      },
    ]);
  });
});
