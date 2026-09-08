import { describe, it, expect } from "bun:test";
import { generateId } from "./manager-utils.js";

describe("generateId()", () => {
  it("uses default prefix and custom prefix", () => {
    const defaultId = generateId();
    expect(defaultId).toMatch(/^s_\d+_[0-9a-f-]{36}$/);

    const customId = generateId("task");
    expect(customId).toMatch(/^task_\d+_[0-9a-f-]{36}$/);
  });

  it("does not reuse session identities across fresh workers at the same millisecond", async () => {
    const script = `
      import { generateId } from ${JSON.stringify(new URL("./manager-utils.ts", import.meta.url).href)};
      Date.now = () => 1788848558229;
      console.log(JSON.stringify(Array.from({ length: 4 }, () => generateId())));
    `;
    const children = Array.from({ length: 4 }, () =>
      Bun.spawn([process.execPath, "-e", script], {
        stdout: "pipe",
        stderr: "pipe",
        timeout: 10_000,
      }),
    );
    try {
      const batches = await Promise.all(
        children.map(async (child) => {
          const [output, error, status] = await Promise.all([
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
            child.exited,
          ]);
          expect(error).toBe("");
          expect(status).toBe(0);
          return JSON.parse(output) as string[];
        }),
      );
      const ids = batches.flat();
      expect(ids).toHaveLength(16);
      expect(new Set(ids).size).toBe(ids.length);
    } finally {
      for (const child of children) if (child.exitCode === null) child.kill();
      await Promise.all(children.map((child) => child.exited));
    }
  });
});
