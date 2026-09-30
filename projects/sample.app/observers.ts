import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { defineObserver } from "@may-agent/sdk";

export const documentObserver = defineObserver({
  id: "document",
  type: "sample.document.observed",
  description: "Inspect an absolute path to a local document readable by this installation. Returns available, and when present sha256 and bytes. Wait for available=true or a particular sha256. Missing files are ordinary unavailable observations; other read errors are reported as failures. This reads the document; it does not create or review it.",
  intervalMs: 10_000,
  timeoutMs: 5_000,
  async inspect(resource, { signal }) {
    if (!isAbsolute(resource)) throw new Error("Document observation requires an absolute file path");
    try {
      const bytes = await readFile(resource, { signal });
      return { available: true, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { available: false };
      throw error;
    }
  },
});
