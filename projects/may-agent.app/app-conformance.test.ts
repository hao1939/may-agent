import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { AppDefinition } from "@may-agent/sdk";

const expectedApps = [
  "evaluation",
  "gym",
  "may",
  "may-agent",
  "scout-knowledge-lib",
].sort();

async function currentApps(): Promise<
  Array<{ path: string; definition: AppDefinition }>
> {
  const projectsRoot = resolve(import.meta.dir, "..");
  const paths = [
    ...new Bun.Glob("*.app/app.ts").scanSync({
      cwd: projectsRoot,
      absolute: true,
    }),
  ].sort();
  return Promise.all(
    paths.map(async (path) => {
      const loaded = (await import(pathToFileURL(path).href)) as {
        default?: AppDefinition;
      };
      if (!loaded.default)
        throw new Error(`App manifest has no default definition: ${path}`);
      return { path, definition: loaded.default };
    }),
  );
}

describe("current App work model", () => {
  test("every App resolves input to one Task and declares no request-owner route", async () => {
    const apps = await currentApps();

    expect(apps.map(({ definition }) => definition.id).sort()).toEqual(
      expectedApps,
    );
    for (const { path, definition } of apps) {
      expect(
        typeof definition.task,
        `${path} must resolve admitted input to a Task`,
      ).toBe("function");
      expect(
        definition.tasks,
        `${path} must declare canonical Task reconciliation`,
      ).toBeDefined();
      expect(
        definition,
        `${path} must not restore the legacy request-owner route`,
      ).not.toHaveProperty("route");
    }
  });
});
