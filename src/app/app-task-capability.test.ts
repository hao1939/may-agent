import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("canonical App task capability boundary", () => {
  it("keeps Project App task-engine imports out of App runtime assembly", () => {
    const runtime = readFileSync(join(import.meta.dir, "app-runtime.ts"), "utf8");
    expect(runtime).not.toContain("project-app-loader");
    expect(runtime).toContain('from "./app-task-capability.js"');
    const socket = readFileSync(join(import.meta.dir, "transport", "socket.ts"), "utf8");
    expect(socket).not.toContain("project-app-loader");
  });
});
