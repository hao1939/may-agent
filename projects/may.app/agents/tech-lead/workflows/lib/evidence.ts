import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, link, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Type, type Static } from "@may-agent/sdk";

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
