import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EvidenceStore } from "./task-evidence.js";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function store() {
  const directory = await mkdtemp(join(tmpdir(), "task-evidence-test-"));
  directories.push(directory);
  return new EvidenceStore(directory);
}

test("arbitrary non-Git work retains exact Unicode data and paginatable text across a replacement reader", async () => {
  const archive = await store();
  const body = "研究来源\n".repeat(5000);
  const value = {
    sourceUrl: "https://example.test/paper",
    sourceVersion: "etag-1",
    question: "What does the source establish?",
    body,
  };
  const refs = await archive.record(value, body);
  const replacement = new EvidenceStore(archive.directory);
  expect(JSON.parse(await replacement.read(refs.record))).toEqual(value);
  expect(await replacement.read(refs.report)).toBe(body);
});

test("concurrent identical publication is complete and corrupted evidence is never silently replaced", async () => {
  const archive = await store();
  const body = JSON.stringify({ report: "evidence".repeat(10000) });
  const refs = await Promise.all(
    Array.from({ length: 8 }, () => archive.put(body, "json")),
  );
  expect(new Set(refs.map((ref) => ref.path)).size).toBe(1);
  expect(await archive.read(refs[0]!)).toBe(body);
  await writeFile(refs[0]!.path, "damaged");
  await expect(archive.put(body, "json")).rejects.toThrow("checksum mismatch");
  expect(await readFile(refs[0]!.path, "utf8")).toBe("damaged");
});

test("missing and foreign references cannot be reused", async () => {
  const archive = await store();
  const other = await store();
  const ref = await archive.put("{}", "json");
  await expect(other.read(ref)).rejects.toThrow("outside this Task's archive");
  await rm(ref.path);
  await expect(archive.read(ref)).rejects.toThrow();
});
