import { afterEach, describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    ctx: {
      appDir,
      task: "digest",
      emit(event: Record<string, unknown>) {
        emitted.push(event);
      },
      log() {},
      done(summary: string, output?: unknown) {
        return { type: "done", summary, output } as const;
      },
    } as never,
  };
}

describe("Scout daily digest", () => {
  it("treats a generated heading as an empty accumulator", async () => {
    const test = fixture("# Scout Findings — 2026-07-20\n\n");

    const result = await execute(test.ctx);

    expect(test.emitted).toHaveLength(0);
    expect(result).toMatchObject({
      type: "done",
      output: { summary: "No findings to digest today." },
    });
  });

  it("does not redeliver content already preserved in a same-day archive", async () => {
    const date = new Date().toISOString().slice(0, 10);
    const body = "### Finding\n\nUseful evidence.";
    const test = fixture(`# Scout Findings — ${date}\n\n${body}\n`, {
      [`${date}.md`]: `# Scout Findings — ${date}\n\n${body}\n`,
    });

    const result = await execute(test.ctx);

    expect(test.emitted).toHaveLength(0);
    expect(result).toMatchObject({
      type: "done",
      output: {
        evidence: expect.arrayContaining(["delivery:idempotent-no-op"]),
      },
    });
    expect(
      normalizedDigestBody(
        readFileSync(join(test.digestDir, "today.md"), "utf8"),
      ),
    ).toBe("");
  });

  it("preserves distinct same-day content in the next immutable archive", async () => {
    const date = new Date().toISOString().slice(0, 10);
    const test = fixture(`# Scout Findings — ${date}\n\n### New finding\n`, {
      [`${date}.md`]: `# Scout Findings — ${date}\n\n### Earlier finding\n`,
    });

    const result = await execute(test.ctx);
    const numbered = join(test.digestDir, `${date}-2.md`);

    expect(test.emitted).toHaveLength(1);
    expect(existsSync(numbered)).toBe(true);
    expect(readFileSync(numbered, "utf8")).toContain("### New finding");
    expect(readFileSync(join(test.digestDir, `${date}.md`), "utf8")).toContain(
      "### Earlier finding",
    );
    expect(result).toMatchObject({
      type: "done",
      summary: `Daily digest sent (${date}). Archived to ${date}-2.md.`,
      output: { evidence: [`digest:${numbered}`] },
    });
  });
});
