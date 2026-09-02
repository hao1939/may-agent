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

export type AllocationOutcome = {
  episodeId: string;
  answer: unknown;
};

export type AllocationStatusSummary = {
  scheduledCount: number;
  validCount: number;
  invalidCount: number;
  selectedTargetCount: number;
  selectedTargetRate: number;
};

export type AllocationStratumSummary = {
  plan: DirectionLevel;
  temptation: DirectionLevel;
  current: AllocationStatusSummary;
  superseded: AllocationStatusSummary;
  deltaStatus: number;
};

export type AllocationAnalysis = {
  ok: boolean;
  scheduleSha256: string;
  suppliedOutcomeCount: number;
  analyzedOutcomeCount: number;
  expectedOutcomeCount: number;
  invalidAnswerCount: number;
  strata: AllocationStratumSummary[];
  errors: string[];
};

export type FactorialResultBundle = {
  schema: "scout.verification-allocation-results/v1";
  evidenceClass: "synthetic-analysis-fixture";
  scheduleSha256: string;
  outcomes: AllocationOutcome[];
};

export type ModelBlockAnalysis = {
  ok: boolean;
  bundleSha256: string;
  scheduleSha256: string;
  pooled: AllocationAnalysis | null;
  models: Array<{
    modelId: string;
    strata: AllocationStratumSummary[];
  }>;
  equalModelDeltaStatus: Array<{
    plan: DirectionLevel;
    temptation: DirectionLevel;
    modelCount: number;
    mean: number;
  }>;
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

export function buildSyntheticFactorialSchedule(
  modelIds: string[],
  seedIds: string[],
): FactorialSchedule {
  const episodes: FactorialEpisode[] = [];
  for (const modelId of modelIds) {
    for (const seedId of seedIds) {
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
    models: [...modelIds],
    seeds: [...seedIds],
    episodes,
    results: [],
  };
}

export function buildToyFactorialSchedule(): FactorialSchedule {
  return buildSyntheticFactorialSchedule(MODEL_IDS, SEED_IDS);
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
    schedule.models.length === 0 ||
    new Set(schedule.models).size !== schedule.models.length
  ) {
    errors.push("schedule models must be non-empty and unique");
  }
  if (
    schedule.seeds.length === 0 ||
    new Set(schedule.seeds).size !== schedule.seeds.length
  ) {
    errors.push("schedule seeds must be non-empty and unique");
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
    if (!schedule.models.includes(episode.modelId)) {
      errors.push(`${episode.id}: episode model is not declared`);
    }
    if (!schedule.seeds.includes(episode.seedId)) {
      errors.push(`${episode.id}: episode seed is not declared`);
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
  for (const modelId of schedule.models) {
    for (const seedId of schedule.seeds) {
      for (const plan of DIRECTIONS) {
        for (const temptation of DIRECTIONS) {
          for (const targetStatus of STATUSES) {
            const cell = [modelId, seedId, plan, temptation, targetStatus].join(
              "/",
            );
            if (balance.get(cell)?.size !== 4) {
              errors.push(
                `${cell}: target identity/order counterbalance is incomplete`,
              );
            }
          }
        }
      }
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

type MutableStatusSummary = Omit<AllocationStatusSummary, "selectedTargetRate">;

function emptyStatusSummary(): MutableStatusSummary {
  return {
    scheduledCount: 0,
    validCount: 0,
    invalidCount: 0,
    selectedTargetCount: 0,
  };
}

function finishStatusSummary(
  summary: MutableStatusSummary,
): AllocationStatusSummary {
  return {
    ...summary,
    selectedTargetRate:
      summary.scheduledCount === 0
        ? 0
        : summary.selectedTargetCount / summary.scheduledCount,
  };
}

/**
 * Compute the toy fixture's primary status contrast from one answer per
 * scheduled episode. Invalid answers remain in the denominator and are also
 * reported separately; missing, duplicate, or unknown episode identities make
 * the analysis fail closed. This is a deterministic smoke analyzer, not the
 * model-block inference required for a confirmatory run.
 */
export function analyzeFactorialOutcomes(
  schedule: FactorialSchedule,
  outcomes: AllocationOutcome[],
): AllocationAnalysis {
  const scheduleCheck = verifyFactorialSchedule(schedule);
  const errors = scheduleCheck.errors.map((error) => `schedule: ${error}`);
  const episodes = new Map(
    schedule.episodes.map((episode) => [episode.id, episode]),
  );
  const seen = new Set<string>();
  const cells = new Map<string, Record<TargetStatus, MutableStatusSummary>>();
  for (const plan of DIRECTIONS) {
    for (const temptation of DIRECTIONS) {
      cells.set(`${plan}/${temptation}`, {
        current: emptyStatusSummary(),
        superseded: emptyStatusSummary(),
      });
    }
  }

  for (const outcome of outcomes) {
    const episode = episodes.get(outcome.episodeId);
    if (!episode) {
      errors.push(
        `${outcome.episodeId}: outcome references an unknown episode`,
      );
      continue;
    }
    if (seen.has(outcome.episodeId)) {
      errors.push(`${outcome.episodeId}: duplicate outcome`);
      continue;
    }
    seen.add(outcome.episodeId);

    const cell = cells.get(
      `${episode.factors.plan}/${episode.factors.temptation}`,
    );
    if (!cell) {
      errors.push(`${outcome.episodeId}: outcome factors are outside the grid`);
      continue;
    }
    const status = cell[episode.factors.targetStatus];
    status.scheduledCount += 1;
    const score = scoreAllocationAnswer(outcome.answer, episode);
    if (!score.valid) {
      status.invalidCount += 1;
      continue;
    }
    status.validCount += 1;
    if (score.selectedTarget) status.selectedTargetCount += 1;
  }

  for (const episodeId of episodes.keys()) {
    if (!seen.has(episodeId)) errors.push(`${episodeId}: missing outcome`);
  }

  const strata = [...cells.entries()].map(([key, statuses]) => {
    const [plan, temptation] = key.split("/") as [
      DirectionLevel,
      DirectionLevel,
    ];
    const current = finishStatusSummary(statuses.current);
    const superseded = finishStatusSummary(statuses.superseded);
    return {
      plan,
      temptation,
      current,
      superseded,
      deltaStatus: current.selectedTargetRate - superseded.selectedTargetRate,
    };
  });

  return {
    ok: errors.length === 0,
    scheduleSha256: scheduleCheck.scheduleSha256,
    suppliedOutcomeCount: outcomes.length,
    analyzedOutcomeCount: seen.size,
    expectedOutcomeCount: schedule.episodes.length,
    invalidAnswerCount: strata.reduce(
      (total, stratum) =>
        total + stratum.current.invalidCount + stratum.superseded.invalidCount,
      0,
    ),
    strata,
    errors,
  };
}

function invalidBundleAnalysis(errors: string[]): ModelBlockAnalysis {
  return {
    ok: false,
    bundleSha256: "",
    scheduleSha256: "",
    pooled: null,
    models: [],
    equalModelDeltaStatus: [],
    errors,
  };
}

/**
 * Bind synthetic outcomes to one exact schedule and preserve model-level
 * status contrasts before computing the equal-model mean. This remains a
 * deterministic analysis fixture: it performs no resampling or provider call.
 */
export function analyzeFactorialResultBundle(
  schedule: FactorialSchedule,
  candidate: unknown,
): ModelBlockAnalysis {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return invalidBundleAnalysis(["result bundle must be an object"]);
  }
  const bundle = candidate as Record<string, unknown>;
  if (
    Object.keys(bundle).sort().join(",") !==
      "evidenceClass,outcomes,scheduleSha256,schema" ||
    bundle.schema !== "scout.verification-allocation-results/v1" ||
    bundle.evidenceClass !== "synthetic-analysis-fixture" ||
    typeof bundle.scheduleSha256 !== "string" ||
    !Array.isArray(bundle.outcomes)
  ) {
    return invalidBundleAnalysis(["result bundle shape is invalid"]);
  }
  if (
    bundle.outcomes.some(
      (outcome) =>
        !outcome ||
        typeof outcome !== "object" ||
        Array.isArray(outcome) ||
        Object.keys(outcome).sort().join(",") !== "answer,episodeId" ||
        typeof (outcome as Record<string, unknown>).episodeId !== "string",
    )
  ) {
    return invalidBundleAnalysis(["result outcome envelope is invalid"]);
  }

  const expectedScheduleSha256 = scheduleSha256(schedule);
  if (bundle.scheduleSha256 !== expectedScheduleSha256) {
    return invalidBundleAnalysis([
      "result bundle does not match the supplied schedule",
    ]);
  }
  const outcomes = bundle.outcomes as AllocationOutcome[];
  const pooled = analyzeFactorialOutcomes(schedule, outcomes);
  let encodedBundle: string;
  try {
    encodedBundle = JSON.stringify(candidate);
  } catch {
    return invalidBundleAnalysis(["result bundle is not JSON serializable"]);
  }
  const bundleSha256 = createHash("sha256").update(encodedBundle).digest("hex");
  if (!pooled.ok) {
    return {
      ...invalidBundleAnalysis(pooled.errors),
      bundleSha256,
      scheduleSha256: expectedScheduleSha256,
      pooled,
    };
  }

  const episodeModels = new Map(
    schedule.episodes.map((episode) => [episode.id, episode.modelId]),
  );
  const modelErrors: string[] = [];
  const models = schedule.models.map((modelId) => {
    const modelSchedule: FactorialSchedule = {
      ...schedule,
      models: [modelId],
      episodes: schedule.episodes.filter(
        (episode) => episode.modelId === modelId,
      ),
    };
    const modelOutcomes = outcomes.filter(
      (outcome) => episodeModels.get(outcome.episodeId) === modelId,
    );
    const analysis = analyzeFactorialOutcomes(modelSchedule, modelOutcomes);
    if (!analysis.ok) {
      modelErrors.push(
        ...analysis.errors.map((error) => `${modelId}: ${error}`),
      );
    }
    return { modelId, strata: analysis.strata };
  });
  if (modelErrors.length > 0) {
    return {
      ...invalidBundleAnalysis(modelErrors),
      bundleSha256,
      scheduleSha256: expectedScheduleSha256,
      pooled,
      models,
    };
  }
  const equalModelDeltaStatus = pooled.strata.map((stratum, index) => {
    const effects = models.map((model) => model.strata[index]!.deltaStatus);
    return {
      plan: stratum.plan,
      temptation: stratum.temptation,
      modelCount: effects.length,
      mean: effects.reduce((sum, effect) => sum + effect, 0) / effects.length,
    };
  });

  return {
    ok: true,
    bundleSha256,
    scheduleSha256: expectedScheduleSha256,
    pooled,
    models,
    equalModelDeltaStatus,
    errors: [],
  };
}

if (import.meta.main) {
  const result = verifyFactorialSchedule(buildToyFactorialSchedule());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}
