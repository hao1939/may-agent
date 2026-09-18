import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, link, rm, open } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { Type, type Static } from "typebox";

export const artifactSchema = Type.Object(
  {
    path: Type.String({ minLength: 1 }),
    sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }),
  },
  { additionalProperties: false },
);
export const recordSchema = Type.Object(
  { record: artifactSchema, report: artifactSchema },
  { additionalProperties: false },
);
export type Artifact = Static<typeof artifactSchema>;
export type EvidenceRecord = Static<typeof recordSchema>;

export type ArtifactRead = {
  reference: Artifact;
  status: "read" | "missing" | "unavailable" | "mismatched" | "truncated";
  bytes?: number;
  sha256?: string;
  content?: string;
};

/** Read only an explicitly pinned regular file. Never present a prefix as a
 * verified artifact: oversized files have metadata, but no consumed content.
 * This is byte integrity, not independent verification of a producer's claim. */
export async function readPinnedArtifact(
  reference: Artifact,
  maxBytes = 32_768,
): Promise<ArtifactRead> {
  if (
    !/^[a-f0-9]{64}$/.test(reference.sha256) ||
    !reference.path.startsWith("/")
  )
    return { reference, status: "unavailable" };
  const limit = Math.max(0, Math.min(131_072, Math.floor(maxBytes) || 0));
  let file;
  try {
    file = await open(
      reference.path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const stat = await file.stat();
    if (!stat.isFile()) return { reference, status: "unavailable" };
    if (stat.size > limit)
      return { reference, status: "truncated", bytes: stat.size };
    // Read at most limit+1, including growth after stat; do not allocate by file size.
    const buffer = Buffer.alloc(limit + 1);
    let bytes = 0;
    while (bytes < buffer.length) {
      const read = await file.read(buffer, bytes, buffer.length - bytes, bytes);
      if (!read.bytesRead) break;
      bytes += read.bytesRead;
    }
    if (bytes > limit) return { reference, status: "truncated", bytes };
    const body = buffer.subarray(0, bytes);
    const sha256 = createHash("sha256").update(body).digest("hex");
    if (sha256 !== reference.sha256)
      return { reference, status: "mismatched", bytes, sha256 };
    return {
      reference,
      status: "read",
      bytes,
      sha256,
      content: body.toString("utf8"),
    };
  } catch (error) {
    return {
      reference,
      status:
        (error as NodeJS.ErrnoException).code === "ENOENT"
          ? "missing"
          : "unavailable",
    };
  } finally {
    await file?.close();
  }
}

export function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** Immutable local evidence, addressed only by references in Runtime results.
 * No latest pointer, phase, work discovery or automatic replay of effects. */
export class EvidenceStore {
  constructor(readonly directory: string) {}

  async put(body: string, extension: "json" | "md"): Promise<Artifact> {
    const sha256 = createHash("sha256").update(body).digest("hex");
    const path = join(this.directory, `${sha256}.${extension}`);
    await mkdir(this.directory, { recursive: true });
    const temporary = join(this.directory, `${sha256}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, body, "utf8");
      try {
        // Publish a complete file without replacing an existing artifact.
        await link(temporary, path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        await this.read({ path, sha256 });
      }
    } finally {
      await rm(temporary, { force: true });
    }
    return { path, sha256 };
  }

  async read(ref: Artifact): Promise<string> {
    const extension = ref.path.endsWith(".md") ? "md" : "json";
    if (
      resolve(ref.path) !==
      resolve(this.directory, `${ref.sha256}.${extension}`)
    ) {
      throw new Error("Evidence reference is outside this Task's archive");
    }
    const body = await readFile(ref.path, "utf8");
    if (createHash("sha256").update(body).digest("hex") !== ref.sha256)
      throw new Error(`Evidence checksum mismatch: ${ref.path}`);
    return body;
  }

  async record(value: unknown, report: string): Promise<EvidenceRecord> {
    const record = await this.put(
      `${JSON.stringify(value, null, 2)}\n`,
      "json",
    );
    // Read-tool friendly: very long strings must not become one oversized line.
    const readable = report.replace(/[^\n]{240}/gu, "$&\n");
    return { record, report: await this.put(readable, "md") };
  }
}
