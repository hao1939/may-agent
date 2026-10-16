import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileWritePolicy } from "./file-write-policy.js";
import { createCodingTools } from "./coding.js";
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "write-policy-"));
  roots.push(root);
  return root;
}
test("the coding preset applies file-write policy only to write and edit, not bash", async () => {
  const root = fixture();
  const protectedPath = join(root, "criteria", "rules.md");
  const policy = {
    protectedPaths: ["criteria/**"],
    grants: [],
  };
  const [_, bash, edit, write] = createCodingTools(root, { agentName: "worker", fileWritePolicy: policy });
  const writeResult = await write!.execute("write", { path: protectedPath, content: "write" });
  expect(writeResult.content[0]).toMatchObject({ text: expect.stringContaining("WRITE BLOCKED") });
  const editResult = await edit!.execute("edit", { path: protectedPath, oldText: "original", newText: "edit" });
  expect(editResult.content[0]).toMatchObject({ text: expect.stringContaining("WRITE BLOCKED") });

  await bash!.execute("bash", {
    command: `mkdir -p criteria && printf bash > criteria/rules.md`,
  });
  expect(readFileSync(protectedPath, "utf8")).toBe("bash");
});

test("captures immutable scope and rejects invalid declarations", () => {
  const root = fixture();
  expect(readFileWritePolicy(root).grants).toEqual([]);
  const path = join(root, "file-write-policy.json");
  const value = { protectedPaths: [], grants: [{ paths: ["projects/quality.app/**"], writers: ["reviewer"] }] };
  writeFileSync(path, JSON.stringify(value));
  const first = readFileWritePolicy(root);
  writeFileSync(path, JSON.stringify({ protectedPaths: [], grants: [] }));
  expect(first.grants).toEqual(value.grants);
  expect(Object.isFrozen(first.grants[0].writers)).toBe(true);
  for (const invalid of [
    null,
    {},
    { protectedPaths: [], grants: [null] },
    { protectedPaths: [], grants: [{ paths: ["../escape"], writers: [] }] },
    { protectedPaths: [], grants: [{ paths: ["/absolute"], writers: [] }] },
    { protectedPaths: [], grants: [{ paths: ["ok"], writers: [true] }] },
  ]) {
    writeFileSync(path, JSON.stringify(invalid));
    expect(() => readFileWritePolicy(root)).toThrow();
  }
});
