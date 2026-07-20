import { afterEach, describe, expect, it } from "bun:test";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildLibraryHealthPacket,
  type LibraryHealthPacket,
} from "./library-health";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function fixture(): { appDir: string; projectDir: string } {
  const root = mkdtempSync(join(tmpdir(), "scout-library-health-"));
  roots.push(root);
  const appDir = join(root, "scout.app");
  const projectDir = join(root, "scout");
  mkdirSync(join(appDir, "agents", "scout", "workspace", "digest"), {
    recursive: true,
  });
  mkdirSync(join(projectDir, "knowledge"), { recursive: true });
  mkdirSync(join(projectDir, "reports"), { recursive: true });
  writeFileSync(join(projectDir, "knowledge", "README.md"), "# Knowledge\n");
  writeFileSync(join(projectDir, "knowledge", "INDEX.md"), "# Index\n");
  writeFileSync(
    join(appDir, "agents", "scout", "workspace", "digest", "today.md"),
    "# Today\n",
  );
  return { appDir, projectDir };
}

function saveHistory(appDir: string, packet: LibraryHealthPacket): void {
  const stateDir = join(appDir, ".state");
  mkdirSync(stateDir, { recursive: true });
  appendFileSync(
    join(stateDir, "library-health-packets.jsonl"),
    `${JSON.stringify(packet)}\n`,
  );
}

function oversizedNote(projectDir: string, lines: number): void {
  writeFileSync(
    join(projectDir, "knowledge", "large.md"),
    Array.from({ length: lines }, () => "line").join("\n"),
  );
}

describe("Scout library-health observer", () => {
  it("wakes for a new fact but not for the same fact in the next packet", () => {
    const paths = fixture();
    const now = Date.parse("2026-07-20T00:00:00.000Z");
    oversizedNote(paths.projectDir, 801);

    const first = buildLibraryHealthPacket({ ...paths, now });
    expect(first.wake_decisions).toContainEqual({
      key: "oversized-canonical-note:knowledge/large.md",
      wake: true,
      reason: "new",
    });

    saveHistory(paths.appDir, first);
    const second = buildLibraryHealthPacket({
      ...paths,
      now: now + 6 * 60 * 60_000,
    });
    expect(second.wake_decisions).toContainEqual({
      key: "oversized-canonical-note:knowledge/large.md",
      wake: false,
      reason: "unchanged",
    });
  });

  it("wakes when a numeric fact becomes materially worse", () => {
    const paths = fixture();
    const now = Date.parse("2026-07-20T00:00:00.000Z");
    oversizedNote(paths.projectDir, 801);
    saveHistory(paths.appDir, buildLibraryHealthPacket({ ...paths, now }));

    oversizedNote(paths.projectDir, 901);
    const packet = buildLibraryHealthPacket({
      ...paths,
      now: now + 6 * 60 * 60_000,
    });

    expect(packet.wake_decisions).toContainEqual({
      key: "oversized-canonical-note:knowledge/large.md",
      wake: true,
      reason: "worse",
    });
  });

  it("wakes for a fact that remains present when its review interval expires", () => {
    const paths = fixture();
    const now = Date.parse("2026-07-20T00:00:00.000Z");
    oversizedNote(paths.projectDir, 801);
    saveHistory(paths.appDir, buildLibraryHealthPacket({ ...paths, now }));

    const packet = buildLibraryHealthPacket({
      ...paths,
      now: now + 7 * 24 * 60 * 60_000,
    });

    expect(packet.wake_decisions).toContainEqual({
      key: "oversized-canonical-note:knowledge/large.md",
      wake: true,
      reason: "review-due",
    });
  });

  it("ignores future dates in runtime task history", () => {
    const paths = fixture();
    mkdirSync(join(paths.appDir, ".state", "tasks"), { recursive: true });
    writeFileSync(
      join(paths.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({ summary: "forecast for 2099-01-01" }),
    );

    const packet = buildLibraryHealthPacket({
      ...paths,
      now: Date.parse("2026-07-20T00:00:00.000Z"),
    });

    expect(
      packet.facts.some((fact) => fact.kind === "future-dated-library-truth"),
    ).toBe(false);
  });

  it("reports an explicit future truth field in canonical knowledge", () => {
    const paths = fixture();
    writeFileSync(
      join(paths.projectDir, "knowledge", "topic.md"),
      "<ai_context>\nlast_updated: 2026-07-21\n</ai_context>\n",
    );

    const packet = buildLibraryHealthPacket({
      ...paths,
      now: Date.parse("2026-07-20T00:00:00.000Z"),
    });

    expect(packet.facts).toContainEqual(
      expect.objectContaining({
        key: "future-dated-library-truth:knowledge/topic.md:last_updated",
        observedValue: "2026-07-21",
      }),
    );
  });

  it("wakes when an existing future truth date moves farther forward", () => {
    const paths = fixture();
    const now = Date.parse("2026-07-20T00:00:00.000Z");
    const path = join(paths.projectDir, "knowledge", "topic.md");
    writeFileSync(path, "last_updated: 2026-07-21\n");
    saveHistory(paths.appDir, buildLibraryHealthPacket({ ...paths, now }));

    writeFileSync(path, "last_updated: 2026-07-22\n");
    const packet = buildLibraryHealthPacket({
      ...paths,
      now: now + 6 * 60 * 60_000,
    });

    expect(packet.wake_decisions).toContainEqual({
      key: "future-dated-library-truth:knowledge/topic.md:last_updated",
      wake: true,
      reason: "worse",
    });
  });

  it("bounds facts and owner wake signals", () => {
    const paths = fixture();
    for (let index = 0; index < 60; index += 1) {
      writeFileSync(
        join(
          paths.projectDir,
          "knowledge",
          `2099-01-${String((index % 28) + 1).padStart(2, "0")}-${index}.md`,
        ),
        "# Future\n",
      );
    }

    const packet = buildLibraryHealthPacket({
      ...paths,
      now: Date.parse("2026-07-20T00:00:00.000Z"),
    });

    expect(packet.facts.length).toBeLessThanOrEqual(50);
    expect(packet.facts.length).toBeGreaterThan(16);
    expect(packet.wake_signals.length).toBe(16);
    expect(packet.truncated).toBe(true);
  });
});
