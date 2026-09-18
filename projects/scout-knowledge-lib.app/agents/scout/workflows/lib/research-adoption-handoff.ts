import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export type QualifiedResearchHandoff = {
  sourceUrl: string;
  sourceRevision: string;
  artifact: string;
  artifactHash: string;
  claim: string;
  limits: string;
  possibleApplication: string;
  relatedWork?: string[];
};

const sha256 = (value: Buffer) =>
  createHash("sha256").update(value).digest("hex");

/**
 * Admit an optional structured Scout recommendation after its durable artifact
 * was published. Code binds the artifact bytes; Scout judges relevance and
 * states source coverage. Source claims remain evidence, not instructions.
 */
export function qualifiedResearchHandoff(
  result: Record<string, unknown> | undefined,
  publishedOutputs: readonly string[],
): QualifiedResearchHandoff | null {
  const value = result?.researchRecommendation;
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("researchRecommendation must be an object");
  const recommendation = value as Record<string, unknown>;
  const required = [
    "sourceUrl",
    "sourceRevision",
    "artifact",
    "claim",
    "limits",
    "possibleApplication",
  ] as const;
  for (const field of required) {
    if (
      typeof recommendation[field] !== "string" ||
      !recommendation[field].trim()
    )
      throw new Error(`Qualified research handoff requires ${field}`);
  }
  if (!/^https:\/\//.test(String(recommendation.sourceUrl)))
    throw new Error("Qualified research handoff requires an HTTPS source URL");
  if (!publishedOutputs.includes(String(recommendation.artifact)))
    throw new Error("Qualified research artifact must be a published output");
  if (
    recommendation.relatedWork !== undefined &&
    (!Array.isArray(recommendation.relatedWork) ||
      recommendation.relatedWork.some(
        (item) => typeof item !== "string" || !item.trim(),
      ))
  ) {
    throw new Error(
      "Qualified research relatedWork must contain non-empty strings",
    );
  }
  return {
    sourceUrl: String(recommendation.sourceUrl),
    sourceRevision: String(recommendation.sourceRevision),
    artifact: String(recommendation.artifact),
    artifactHash: sha256(readFileSync(String(recommendation.artifact))),
    claim: String(recommendation.claim),
    limits: String(recommendation.limits),
    possibleApplication: String(recommendation.possibleApplication),
    ...(recommendation.relatedWork
      ? { relatedWork: structuredClone(recommendation.relatedWork as string[]) }
      : {}),
  };
}

export function researchHandoffKey(handoff: QualifiedResearchHandoff): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        handoff.sourceUrl,
        handoff.sourceRevision,
        handoff.artifactHash,
      ]),
    )
    .digest("hex");
}
