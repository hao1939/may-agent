import { afterEach, describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  appendFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { execute, normalizedDigestBody } from "./scout-daily-digest";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function fixture(today: string, archives: Record<string, string> = {}) {
  const appDir = mkdtempSync(join(tmpdir(), "scout-digest-"));
  roots.push(appDir);
  const digestDir = join(appDir, "agents", "scout", "workspace", "digest");
  mkdirSync(digestDir, { recursive: true });
  writeFileSync(join(digestDir, "today.md"), today);
  for (const [name, content] of Object.entries(archives))
    writeFileSync(join(digestDir, name), content);
  const emitted: Record<string, unknown>[] = [];
  return {
    appDir,
    digestDir,
    emitted,
    ctx: createTestAppWorkflowContext({
      input: {},
      reconciliation: {
        appId: "scout-knowledge-lib",
        taskId: "daily-digest",
        generation: 1,
        resourceVersion: 9,
        agent: "scout",
        outcome: "Preserve findings and hand the daily digest to May",
        acceptance: [
          "Preserve findings and record a retry-stable handoff without claiming delivery",
        ],
        input: {},
        children: { live: [], completed: [] },
        events: { throughEventId: 5925535, items: [] },
      },
      workspace: {
        appRoot: appDir,
        projectRoot: appDir,
        root: appDir,
        output: join(appDir, ".state", "output"),
      },
      emit: async (event) => {
        emitted.push(event as unknown as Record<string, unknown>);
      },
    }),
  };
}

describe("Scout daily digest", () => {
  it("treats a generated heading as an empty accumulator", async () => {
    const test = fixture("# Scout Findings — 2026-07-20\n\n");

    const result = await execute(test.ctx);

    expect(test.emitted).toHaveLength(0);
    expect(result).toMatchObject({
      status: "done",
      output: { summary: "No findings to digest today." },
    });
  });

  it("does not mistake an old archive for proof of a Conversation handoff", async () => {
    const date = new Date().toISOString().slice(0, 10);
    const body = "### Finding\n\nUseful evidence.";
    const test = fixture(`# Scout Findings — ${date}\n\n${body}\n`, {
      [`${date}.md`]: `# Scout Findings — ${date}\n\n${body}\n`,
    });

    const result = await execute(test.ctx);

    expect(test.emitted).toHaveLength(1);
    expect(test.emitted[0]).toMatchObject({
      type: "message.created",
      owner: "agent:may",
      target: { appId: "may" },
      data: { from: "scout", to: "may", sourceAppId: "scout-knowledge-lib" },
    });
    expect(result).toMatchObject({
      status: "done",
      output: {
        facts: expect.arrayContaining([
          "handoff:may",
          "provider-delivery:not-verified",
        ]),
      },
    });
    expect(
      normalizedDigestBody(
        readFileSync(join(test.digestDir, "today.md"), "utf8"),
      ),
    ).toBe("");
  });

  it("preserves a content-addressed snapshot without replacing earlier archives", async () => {
    const date = new Date().toISOString().slice(0, 10);
    const test = fixture(`# Scout Findings — ${date}\n\n### New finding\n`, {
      [`${date}.md`]: `# Scout Findings — ${date}\n\n### Earlier finding\n`,
    });

    const result = await execute(test.ctx);
    const snapshot = join(
      test.digestDir,
      readdirSync(test.digestDir).find((file) => file.startsWith("digest-"))!,
    );

    expect(test.emitted).toEqual([
      expect.objectContaining({
        type: "message.created",
        data: expect.objectContaining({ to: "may", artifact: snapshot }),
      }),
    ]);
    expect(existsSync(snapshot)).toBe(true);
    expect(readFileSync(snapshot, "utf8")).toContain("### New finding");
    expect(readFileSync(join(test.digestDir, `${date}.md`), "utf8")).toContain(
      "### Earlier finding",
    );
    expect(result).toMatchObject({
      status: "done",
      output: {
        facts: [
          `digest:${snapshot}`,
          "handoff:may",
          "provider-delivery:not-verified",
        ],
      },
    });
    expect(result.summary).not.toContain("sent");
  });

  it("retains findings and the snapshot when publication fails", async () => {
    const raw = "# Scout Findings — 2026-09-10\n\n### Useful finding\n";
    const test = fixture(raw);
    test.ctx.events.emit = async () => {
      throw new Error("publication unavailable");
    };

    const result = await execute(test.ctx);

    expect(result.status).toBe("blocked");
    expect(readFileSync(join(test.digestDir, "today.md"), "utf8")).toBe(raw);
    const files = readdirSync(test.digestDir).filter((file) =>
      file.startsWith("digest-"),
    );
    expect(files).toHaveLength(1);
    expect(readFileSync(join(test.digestDir, files[0]), "utf8")).toContain(
      "Useful finding",
    );
  });

  it("reuses the same payload after failure, another wake, and a date change", async () => {
    const test = fixture(
      "# Scout Findings — 2026-09-10\n\n### Useful finding\n",
    );
    let firstEvent: unknown;
    test.ctx.events.emit = async (event) => {
      firstEvent = structuredClone(event);
      throw new Error("receipt lost after possible publication");
    };
    expect((await execute(test.ctx)).status).toBe("blocked");
    test.ctx.reconciliation!.events.throughEventId = 5925600;
    writeFileSync(
      join(test.digestDir, "today.md"),
      "# Scout Findings — 2026-09-11\n\n### Useful finding\n",
    );
    test.ctx.events.emit = async (event) => {
      expect(event).toEqual(firstEvent);
    };

    expect((await execute(test.ctx)).status).toBe("done");
    expect(
      readdirSync(test.digestDir).filter((file) => file.startsWith("digest-")),
    ).toHaveLength(1);
  });

  it("keeps additions made during publication out of the earlier snapshot", async () => {
    const raw = "# Scout Findings — 2026-09-10\n\n### Earlier finding\n";
    const addition = "\n### New finding during handoff\n";
    const test = fixture(raw);
    test.ctx.events.emit = async (event) => {
      test.emitted.push(event as unknown as Record<string, unknown>);
      appendFileSync(join(test.digestDir, "today.md"), addition);
    };

    const result = await execute(test.ctx);

    expect(result.summary).toContain("left untouched");
    expect(readFileSync(join(test.digestDir, "today.md"), "utf8")).toBe(
      raw + addition,
    );
    const snapshot = String(
      (test.emitted[0].data as Record<string, unknown>).artifact,
    );
    expect(readFileSync(snapshot, "utf8")).not.toContain(
      "New finding during handoff",
    );
  });

  it("does not overwrite an altered snapshot or clear its source", async () => {
    const raw = "# Scout Findings — 2026-09-10\n\n### Useful finding\n";
    const test = fixture(raw);
    await execute(test.ctx);
    const snapshot = String(
      (test.emitted[0].data as Record<string, unknown>).artifact,
    );
    writeFileSync(snapshot, "External edit: keep this evidence.");
    writeFileSync(join(test.digestDir, "today.md"), raw);

    const result = await execute(test.ctx);

    expect(result.status).toBe("blocked");
    expect(test.emitted).toHaveLength(1);
    expect(readFileSync(snapshot, "utf8")).toBe(
      "External edit: keep this evidence.",
    );
    expect(readFileSync(join(test.digestDir, "today.md"), "utf8")).toBe(raw);
  });
});
