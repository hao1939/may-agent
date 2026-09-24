import { afterEach, describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  inspectLibraryHealthReadonly,
  parseReadonlyLibraryHealthOptions,
} from "./library-health-readonly";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture(): { appDir: string; projectDir: string } {
  const root = mkdtempSync(join(tmpdir(), "scout-health-readonly-"));
  roots.push(root);
  const appDir = join(root, "scout.app");
  const projectDir = join(root, "scout");
  mkdirSync(join(appDir, "agents", "scout", "workspace", "digest"), {
    recursive: true,
  });
  mkdirSync(join(projectDir, "knowledge"), { recursive: true });
  mkdirSync(join(projectDir, "reports"), { recursive: true });
  writeFileSync(join(projectDir, "knowledge", "README.md"), "# Knowledge\n");
  writeFileSync(
    join(projectDir, "knowledge", "INDEX.md"),
    "# Index\n\n- [Knowledge](README.md)\n",
  );
  writeFileSync(
    join(appDir, "agents", "scout", "workspace", "digest", "today.md"),
    "# Today\n",
  );
  return { appDir, projectDir };
}

describe("read-only Scout library-health inspection", () => {
  it("returns the deterministic packet without creating runtime state", () => {
    const paths = fixture();
    const options = parseReadonlyLibraryHealthOptions([], paths);
    const result = inspectLibraryHealthReadonly({
      ...options,
      now: Date.parse("2026-09-01T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      appDir: paths.appDir,
      projectDir: paths.projectDir,
      generatedAt: "2026-09-01T00:00:00.000Z",
      factCount: 0,
      wakeSignalCount: 0,
      truncated: false,
      observations: { complete: true, read_error_count: 0, read_errors: [] },
    });
    expect(existsSync(join(paths.appDir, ".state"))).toBe(false);
  });

  it("accepts explicit roots and rejects an invalid clock", () => {
    const paths = fixture();
    expect(
      parseReadonlyLibraryHealthOptions(
        [
          "--app-dir",
          paths.appDir,
          "--project-dir",
          paths.projectDir,
          "--now",
          "2026-09-01T08:00:00+08:00",
        ],
        { appDir: "/unused", projectDir: "/unused" },
      ),
    ).toEqual({
      ...paths,
      now: Date.parse("2026-09-01T08:00:00+08:00"),
    });

    expect(() =>
      parseReadonlyLibraryHealthOptions(["--now", "not-a-date"], paths),
    ).toThrow("Invalid --now value: not-a-date");
  });
});
