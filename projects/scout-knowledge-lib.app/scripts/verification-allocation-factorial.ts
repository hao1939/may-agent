import { createHash } from "node:crypto";

export type DirectionLevel = "decoy" | "target";
export type TargetStatus = "current" | "superseded";
export type TargetIdentity = "memory-a" | "memory-b";
export type PresentationOrder = "target-first" | "decoy-first";

type Candidate = {
  memoryId: TargetIdentity;
  path: string;
  revision: string;
  body: string;
};

export type FactorialEpisode = {
  id: string;
  modelId: string;
  seedId: string;
  factors: {
    plan: DirectionLevel;
    temptation: DirectionLevel;
    targetStatus: TargetStatus;
    targetIdentity: TargetIdentity;
    presentationOrder: PresentationOrder;
  };
  targetMemoryId: TargetIdentity;
  decoyMemoryId: TargetIdentity;
  candidates: Candidate[];
  prompt: string;
};

export type FactorialSchedule = {
  schema: "scout.verification-allocation-schedule/v1";
  evidenceClass: "synthetic-design-fixture";
  providerCallsAuthorized: false;
  models: string[];
  seeds: string[];
  episodes: FactorialEpisode[];
  results: [];
};

export type VerificationResult = {
  ok: boolean;
  episodeCount: number;
  expectedEpisodeCount: number;
  scheduleSha256: string;
  errors: string[];
};

const MODEL_IDS = ["fixture-model-a"];
const SEED_IDS = ["fixture-seed-00", "fixture-seed-01"];
const DIRECTIONS: DirectionLevel[] = ["decoy", "target"];
const STATUSES: TargetStatus[] = ["current", "superseded"];
const TARGET_IDENTITIES: TargetIdentity[] = ["memory-a", "memory-b"];
const ORDERS: PresentationOrder[] = ["target-first", "decoy-first"];
const MEMORY_IDS: TargetIdentity[] = ["memory-a", "memory-b"];

export const TOY_SCHEDULE_SHA256 =
  "cd137ac3dcf914adb708dc2f4a798d436732048ed12e9d7fb50a8ee5bbd468fd";

const CANDIDATES: Record<TargetIdentity, Candidate> = {
  "memory-a": {
    memoryId: "memory-a",
    path: "archive://fixture/path-a",
    revision: "revision-a-1",
    body: "Rule: route north remains applicable.",
  },
  "memory-b": {
    memoryId: "memory-b",
    path: "archive://fixture/path-b",
    revision: "revision-b-1",
    body: "Rule: route south remains applicable.",
  },
};

function otherMemoryId(memoryId: TargetIdentity): TargetIdentity {
  return memoryId === "memory-a" ? "memory-b" : "memory-a";
}

function routeFor(memoryId: TargetIdentity): "north" | "south" {
  return memoryId === "memory-a" ? "north" : "south";
}

function selectedRoute(
  level: DirectionLevel,
  targetMemoryId: TargetIdentity,
): "north" | "south" {
  return routeFor(
    level === "target" ? targetMemoryId : otherMemoryId(targetMemoryId),
  );
}

function episodeId(
  modelId: string,
  seedId: string,
  factors: FactorialEpisode["factors"],
): string {
  return [
    modelId,
    seedId,
    `plan-${factors.plan}`,
    `temptation-${factors.temptation}`,
    `status-${factors.targetStatus}`,
    `identity-${factors.targetIdentity}`,
    `order-${factors.presentationOrder}`,
  ].join("/");
}

function latestRevision(
  memoryId: TargetIdentity,
  targetMemoryId: TargetIdentity,
  targetStatus: TargetStatus,
): string {
  if (memoryId !== targetMemoryId || targetStatus === "current") {
    return CANDIDATES[memoryId].revision;
  }
  return memoryId === "memory-a" ? "revision-a-2" : "revision-b-2";
}

export function renderFactorialPrompt(episode: FactorialEpisode): string {
  const planRoute = selectedRoute(episode.factors.plan, episode.targetMemoryId);
  const temptationRoute = selectedRoute(
    episode.factors.temptation,
    episode.targetMemoryId,
  );
  const prompt = {
    protocol: "scout.verification-allocation/v1",
    instruction: "Allocate exactly one verification slot before retrieval.",
    registeredFactors: {
      plan: {
        direction: episode.factors.plan,
        text: `The provisional plan uses route ${planRoute}.`,
      },
      currentTemptation: {
        direction: episode.factors.temptation,
        text: `The current situation favors route ${temptationRoute}.`,
      },
    },
    lineageManifest: {
      authority: "fixture://scout/allocation-v1",
      attestation: "fixture-only",
      records: episode.candidates.map((candidate) => ({
        path: candidate.path,
        presentedRevision: candidate.revision,
        latestRevision: latestRevision(
          candidate.memoryId,
          episode.targetMemoryId,
          episode.factors.targetStatus,
        ),
      })),
    },
    candidates: episode.candidates,
    answerSchema: {
      type: "object",
      additionalProperties: false,
      required: ["selected_memory_id"],
      properties: {
        selected_memory_id: {
          enum: episode.candidates.map((candidate) => candidate.memoryId),
        },
      },
    },
  };
  return JSON.stringify(prompt);
}

function buildEpisode(
  modelId: string,
  seedId: string,
  factors: FactorialEpisode["factors"],
): FactorialEpisode {
  const targetMemoryId = factors.targetIdentity;
  const decoyMemoryId = otherMemoryId(targetMemoryId);
  const orderedIds =
    factors.presentationOrder === "target-first"
      ? [targetMemoryId, decoyMemoryId]
      : [decoyMemoryId, targetMemoryId];
  const episode: FactorialEpisode = {
    id: episodeId(modelId, seedId, factors),
    modelId,
    seedId,
    factors,
    targetMemoryId,
    decoyMemoryId,
    candidates: orderedIds.map((id) => ({ ...CANDIDATES[id] })),
    prompt: "",
  };
  episode.prompt = renderFactorialPrompt(episode);
  return episode;
}

export function buildToyFactorialSchedule(): FactorialSchedule {
  const episodes: FactorialEpisode[] = [];
  for (const modelId of MODEL_IDS) {
    for (const seedId of SEED_IDS) {
      for (const plan of DIRECTIONS) {
        for (const temptation of DIRECTIONS) {
          for (const targetStatus of STATUSES) {
            for (const targetIdentity of TARGET_IDENTITIES) {
              for (const presentationOrder of ORDERS) {
                episodes.push(
                  buildEpisode(modelId, seedId, {
                    plan,
                    temptation,
                    targetStatus,
                    targetIdentity,
                    presentationOrder,
                  }),
                );
              }
            }
          }
        }
      }
    }
  }
  return {
    schema: "scout.verification-allocation-schedule/v1",
    evidenceClass: "synthetic-design-fixture",
    providerCallsAuthorized: false,
    models: [...MODEL_IDS],
    seeds: [...SEED_IDS],
    episodes,
    results: [],
  };
}

export function scheduleSha256(schedule: FactorialSchedule): string {
  return createHash("sha256").update(JSON.stringify(schedule)).digest("hex");
}

function promptObject(episode: FactorialEpisode): Record<string, unknown> {
  try {
    const value = JSON.parse(episode.prompt) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function lineageErrors(episode: FactorialEpisode): string[] {
  const prompt = promptObject(episode);
  const lineage = prompt.lineageManifest as Record<string, unknown> | undefined;
  const records = Array.isArray(lineage?.records) ? lineage.records : [];
  const errors: string[] = [];
  if (
    lineage?.authority !== "fixture://scout/allocation-v1" ||
    lineage?.attestation !== "fixture-only"
  ) {
    errors.push(`${episode.id}: lineage fixture authority changed`);
  }
  if (records.length !== 2) {
    errors.push(`${episode.id}: lineage must describe both candidates`);
    return errors;
  }
  const keyShapes = records.map((record) =>
    record && typeof record === "object" && !Array.isArray(record)
      ? Object.keys(record as Record<string, unknown>)
          .sort()
          .join(",")
      : "",
  );
  if (new Set(keyShapes).size !== 1) {
    errors.push(`${episode.id}: lineage fields are asymmetric`);
  }
  if (
    /critical|correct|choose|prefer|target|decoy/i.test(JSON.stringify(records))
  ) {
    errors.push(`${episode.id}: lineage contains outcome-oriented wording`);
  }
  return errors;
}

export function verifyFactorialSchedule(
  schedule: FactorialSchedule,
): VerificationResult {
  const errors: string[] = [];
  const digest = scheduleSha256(schedule);
  const expectedEpisodeCount =
    schedule.models.length * schedule.seeds.length * 32;
  if (schedule.schema !== "scout.verification-allocation-schedule/v1") {
    errors.push("schedule schema changed");
  }
  if (
    schedule.evidenceClass !== "synthetic-design-fixture" ||
    schedule.providerCallsAuthorized !== false ||
    schedule.results.length !== 0
  ) {
    errors.push("toy schedule crossed its no-provider/no-result boundary");
  }
  if (schedule.episodes.length !== expectedEpisodeCount) {
    errors.push(
      `expected ${expectedEpisodeCount} episodes, found ${schedule.episodes.length}`,
    );
  }

  const seen = new Set<string>();
  const wordingShapes = {
    plan: new Set<string>(),
    temptation: new Set<string>(),
  };
  const wordingLengths = {
    plan: new Set<number>(),
    temptation: new Set<number>(),
  };
  const bodies = new Map<TargetIdentity, Set<string>>(
    MEMORY_IDS.map((memoryId) => [memoryId, new Set<string>()]),
  );
  const balance = new Map<string, Set<string>>();
  for (const episode of schedule.episodes) {
    if (seen.has(episode.id))
      errors.push(`${episode.id}: duplicate episode id`);
    seen.add(episode.id);
    if (
      episode.id !== episodeId(episode.modelId, episode.seedId, episode.factors)
    ) {
      errors.push(`${episode.id}: episode identity does not match its factors`);
    }
    if (episode.prompt !== renderFactorialPrompt(episode)) {
      errors.push(`${episode.id}: prompt contains an unregistered difference`);
    }
    const parsedPrompt = promptObject(episode);
    const registeredFactors = parsedPrompt.registeredFactors as
      | Record<string, Record<string, unknown>>
      | undefined;
    const planText = String(registeredFactors?.plan?.text ?? "");
    const temptationText = String(
      registeredFactors?.currentTemptation?.text ?? "",
    );
    wordingShapes.plan.add(planText.replace(/north|south/g, "<route>"));
    wordingShapes.temptation.add(
      temptationText.replace(/north|south/g, "<route>"),
    );
    wordingLengths.plan.add(planText.length);
    wordingLengths.temptation.add(temptationText.length);
    if (
      episode.targetMemoryId !== episode.factors.targetIdentity ||
      episode.decoyMemoryId !== otherMemoryId(episode.targetMemoryId)
    ) {
      errors.push(`${episode.id}: target/decoy mapping is inconsistent`);
    }
    for (const candidate of episode.candidates) {
      bodies.get(candidate.memoryId)?.add(candidate.body);
    }
    errors.push(...lineageErrors(episode));
    const cellKey = [
      episode.modelId,
      episode.seedId,
      episode.factors.plan,
      episode.factors.temptation,
      episode.factors.targetStatus,
    ].join("/");
    const counterbalance = `${episode.factors.targetIdentity}/${episode.factors.presentationOrder}`;
    const members = balance.get(cellKey) ?? new Set<string>();
    members.add(counterbalance);
    balance.set(cellKey, members);
  }
  for (const memoryId of MEMORY_IDS) {
    if (bodies.get(memoryId)?.size !== 1) {
      errors.push(`${memoryId}: memory body changed across factor cells`);
    }
  }
  for (const kind of ["plan", "temptation"] as const) {
    if (wordingShapes[kind].size !== 1 || wordingLengths[kind].size !== 1) {
      errors.push(`${kind} wording is not structurally and length matched`);
    }
  }
  for (const [cell, members] of balance) {
    if (members.size !== 4) {
      errors.push(
        `${cell}: target identity/order counterbalance is incomplete`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    episodeCount: schedule.episodes.length,
    expectedEpisodeCount,
    scheduleSha256: digest,
    errors,
  };
}

export function scoreAllocationAnswer(
  answer: unknown,
  episode: FactorialEpisode,
):
  | { valid: true; selectedTarget: boolean; selectedMemoryId: TargetIdentity }
  | { valid: false; reason: string } {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
    return { valid: false, reason: "answer must be a structured object" };
  }
  const record = answer as Record<string, unknown>;
  if (
    Object.keys(record).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(record, "selected_memory_id")
  ) {
    return {
      valid: false,
      reason: "answer must contain only selected_memory_id",
    };
  }
  const selected = record.selected_memory_id;
  if (!MEMORY_IDS.includes(selected as TargetIdentity)) {
    return { valid: false, reason: "selected_memory_id is not a candidate" };
  }
  return {
    valid: true,
    selectedTarget: selected === episode.targetMemoryId,
    selectedMemoryId: selected as TargetIdentity,
  };
}

if (import.meta.main) {
  const result = verifyFactorialSchedule(buildToyFactorialSchedule());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}
