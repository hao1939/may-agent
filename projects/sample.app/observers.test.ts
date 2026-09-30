import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { documentObserver } from "./observers.js";

test("a missing document becomes available with its exact byte identity; read failures stay failures", async () => {
  const root = await mkdtemp(join(tmpdir(), "sample-document-"));
  const path = join(root, "review.md");
  const signal = new AbortController().signal;
  try {
    expect(await documentObserver.inspect(path, { signal })).toEqual({ available: false });
    const document = "# Review\nA document containing Unicode: 知识.\n";
    await writeFile(path, document);
    expect(await documentObserver.inspect(path, { signal })).toEqual({
      available: true, sha256: createHash("sha256").update(document).digest("hex"), bytes: Buffer.byteLength(document),
    });
    await writeFile(path, "updated");
    expect((await documentObserver.inspect(path, { signal })).sha256).not.toBe(createHash("sha256").update(document).digest("hex"));
    await expect(documentObserver.inspect(root, { signal })).rejects.toThrow();
    await expect(documentObserver.inspect("relative.md", { signal })).rejects.toThrow("absolute");
    await expect(documentObserver.inspect(path, { signal: AbortSignal.abort() })).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
