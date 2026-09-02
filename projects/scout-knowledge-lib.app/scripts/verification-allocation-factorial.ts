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

export type ModelRunBlockBootstrapSpec = {
  schema: "scout.verification-allocation-block-bootstrap/v1";
  evidenceClass: "synthetic-analysis-fixture";
  resamplingUnit: "model-seed-block";
  modelWeighting: "equal-model";
  resamplingSeedSha256: string;
  resamples: number;
  lowerQuantile: number;
  upperQuantile: number;
};

type BootstrapInterval = {
  plan: DirectionLevel;
  temptation: DirectionLevel;
  pointEstimate: number;
  lower: number;
  upper: number;
};

export type ModelRunBlockBootstrapAnalysis = {
  ok: boolean;
  bundleSha256: string;
  scheduleSha256: string;
  bootstrapSpecSha256: string;
  resamplingUnit: "model-seed-block" | "";
  models: Array<{
    modelId: string;
    runBlockCount: number;
    strata: BootstrapInterval[];
  }>;
  equalModel: Array<
    BootstrapInterval & {
      modelCount: number;
      modelMinimum: number;
      modelMaximum: number;
      directionConflict: boolean;
    }
  >;
  errors: string[];
};

export type PracticalEffectDecision =
  | "positive"
  | "negative"
  | "negligible"
  | "inconclusive";

export type PracticalEffectDecisionSpec = {
  schema: "scout.verification-allocation-practical-decision/v1";
  evidenceClass: "synthetic-analysis-fixture";
  practicalDelta: number;
  intervalRule: "percentile";
  namedModelPolicy: "unanimous";
  conflictPolicy: "inconclusive";
};

export type PracticalEffectDecisionAnalysis = {
  ok: boolean;
  scheduleSha256: string;
  bundleSha256: string;
  bootstrapSpecSha256: string;
  decisionSpecSha256: string;
  strata: Array<{
    plan: DirectionLevel;
    temptation: DirectionLevel;
    modelDecisions: Array<{
      modelId: string;
      decision: PracticalEffectDecision;
    }>;
    aggregateIntervalDecision: PracticalEffectDecision;
    decision: PracticalEffectDecision;
    reason: string;
  }>;
  errors: string[];
};

export type PercentileNullCalibrationSpec = {
  schema: "scout.verification-allocation-null-calibration/v1";
  evidenceClass: "synthetic-analysis-fixture";
  calibrationMethod: "exact-trinomial-enumeration";
  effectSupport: [-1, 0, 1];
  practicalDelta: number;
  lowerQuantile: number;
  upperQuantile: number;
  falseDirectionalTolerance: number;
  candidateMinimumRunBlocks: number;
  verificationMaximumRunBlocks: number;
  reportRunBlockCounts: number[];
  processes: Array<{
    id: string;
    probabilities: [number, number, number];
  }>;
};

export type PercentileNullCalibrationAnalysis = {
  ok: boolean;
  calibrationSpecSha256: string;
  calibrationMethod: "exact-trinomial-enumeration" | "";
  monteCarloStandardError: 0 | null;
  supportedCandidateMinimumRunBlocks: number | null;
  report: Array<{
    processId: string;
    runBlockCount: number;
    falsePositiveDirectionProbability: number;
    falseNegativeDirectionProbability: number;
    falseDirectionalProbability: number;
    passesTolerance: boolean;
  }>;
  verificationWorstCases: Array<{
    processId: string;
    runBlockCount: number;
    falseDirectionalProbability: number;
  }>;
  scopeLimit: string;
  errors: string[];
};

export type PercentileAlternativeCalibrationSpec = {
  schema: "scout.verification-allocation-alternative-calibration/v1";
  evidenceClass: "synthetic-analysis-fixture";
  calibrationMethod: "exact-trinomial-enumeration";
  effectSupport: [-1, 0, 1];
  practicalDelta: number;
  lowerQuantile: number;
  upperQuantile: number;
  runBlockCount: number;
  minimumCorrectDirectionalPower: number;
  maximumWrongDirectionalProbability: number;
  processes: Array<{
    id: string;
    pairId: string;
    expectedDirection: "positive" | "negative";
    probabilities: [number, number, number];
  }>;
};

export type PercentileAlternativeCalibrationAnalysis = {
  ok: boolean;
  calibrationSpecSha256: string;
  calibrationMethod: "exact-trinomial-enumeration" | "";
  monteCarloStandardError: 0 | null;
  runBlockCount: number;
  report: Array<{
    processId: string;
    pairId: string;
    expectedDirection: "positive" | "negative";
    expectedEffect: number;
    correctDirectionalProbability: number;
    wrongDirectionalProbability: number;
    negligibleProbability: number;
    inconclusiveProbability: number;
    passesPowerTarget: boolean;
    passesWrongDirectionTolerance: boolean;
  }>;
  scopeLimit: string;
  errors: string[];
};

export type PercentileAlternativePowerSearchSpec = Omit<
  PercentileAlternativeCalibrationSpec,
  "schema" | "runBlockCount"
> & {
  schema: "scout.verification-allocation-alternative-power-search/v1";
  minimumRunBlockCount: number;
  maximumRunBlockCount: number;
  reportRunBlockCounts: number[];
};

export type PercentileAlternativePowerSearchAnalysis = {
  ok: boolean;
  searchSpecSha256: string;
  calibrationMethod: "exact-trinomial-enumeration" | "";
  monteCarloStandardError: 0 | null;
  scannedRunBlockCounts: {
    minimum: number;
    maximum: number;
    total: number;
  } | null;
  pairs: Array<{
    pairId: string;
    expectedEffectMagnitude: number;
    firstPassingRunBlockCount: number | null;
    maximumCorrectDirectionalProbability: number;
    maximumCorrectDirectionalProbabilityRunBlockCount: number;
    maximumWrongDirectionalProbability: number;
    passesPowerWithinRange: boolean;
  }>;
  report: Array<{
    runBlockCount: number;
    processes: PercentileAlternativeCalibrationAnalysis["report"];
  }>;
  scopeLimit: string;
  errors: string[];
};

export type PercentileUnanimousPowerSpec = {
  schema: "scout.verification-allocation-unanimous-power/v1";
  evidenceClass: "synthetic-analysis-fixture";
  dependenceTreatment: "unknown-frechet-bounds-with-independent-illustration";
  modelCount: number;
  minimumUnanimousCorrectDirectionalPower: number;
  perModelCalibration: PercentileAlternativeCalibrationSpec;
};

export type PercentileUnanimousPowerAnalysis = {
  ok: boolean;
  unanimousPowerSpecSha256: string;
  perModelCalibrationSpecSha256: string;
  dependenceTreatment:
    | "unknown-frechet-bounds-with-independent-illustration"
    | "";
  modelCount: number;
  runBlockCountPerModel: number;
  requiredPerModelPowerForGuaranteedUnanimity: number;
  requiredPerModelPowerUnderIndependentIllustration: number;
  report: Array<{
    processId: string;
    pairId: string;
    expectedDirection: "positive" | "negative";
    expectedEffect: number;
    perModelCorrectDirectionalProbability: number;
    unanimousCorrectDirectionalLowerBound: number;
    unanimousCorrectDirectionalUpperBound: number;
    independentCorrectDirectionalIllustration: number;
    perModelWrongDirectionalProbability: number;
    unanimousWrongDirectionalLowerBound: number;
    unanimousWrongDirectionalUpperBound: number;
    independentWrongDirectionalIllustration: number;
    passesGuaranteedUnanimousPowerTarget: boolean;
    passesIndependentIllustrationPowerTarget: boolean;
  }>;
  scopeLimit: string;
  errors: string[];
};

export type PercentileEstimandComparisonSpec = {
  schema: "scout.verification-allocation-estimand-comparison/v1";
  evidenceClass: "synthetic-analysis-fixture";
  calibrationMethod: "exact-trinomial-enumeration";
  effectSupport: [-1, 0, 1];
  directionalDecisionDelta: 0;
  practicalDecisionDelta: number;
  lowerQuantile: number;
  upperQuantile: number;
  runBlockCount: number;
  minimumCorrectDirectionalPower: number;
  maximumWrongDirectionalProbability: number;
  nullProcesses: PercentileNullCalibrationSpec["processes"];
  alternativeProcesses: PercentileAlternativeCalibrationSpec["processes"];
};

export type PercentileEstimandComparisonAnalysis = {
  ok: boolean;
  comparisonSpecSha256: string;
  calibrationMethod: "exact-trinomial-enumeration" | "";
  monteCarloStandardError: 0 | null;
  runBlockCount: number;
  estimands: Array<{
    estimand: "directional" | "practical-exceedance";
    decisionDelta: number;
    nullReport: Array<{
      processId: string;
      falsePositiveDirectionProbability: number;
      falseNegativeDirectionProbability: number;
      falseDirectionalProbability: number;
      passesWrongDirectionTolerance: boolean;
    }>;
    alternativeReport: PercentileAlternativeCalibrationAnalysis["report"];
  }>;
  scopeLimit: string;
  errors: string[];
};

export type DirectionalQuantileCalibrationSpec = {
  schema: "scout.verification-allocation-directional-quantile-calibration/v1";
  evidenceClass: "synthetic-analysis-fixture";
  calibrationMethod: "exact-trinomial-enumeration";
  effectSupport: [-1, 0, 1];
  directionalDecisionDelta: 0;
  runBlockCount: number;
  candidateLowerQuantiles: number[];
  selectionPolicy: "first-passing-all-nulls";
  maximumFalseDirectionalProbability: number;
  nullProcesses: PercentileNullCalibrationSpec["processes"];
};

export type DirectionalQuantileCalibrationAnalysis = {
  ok: boolean;
  calibrationSpecSha256: string;
  calibrationMethod: "exact-trinomial-enumeration" | "";
  monteCarloStandardError: 0 | null;
  runBlockCount: number;
  candidates: Array<{
    lowerQuantile: number;
    upperQuantile: number;
    nullReport: PercentileEstimandComparisonAnalysis["estimands"][number]["nullReport"];
    passesAllNulls: boolean;
  }>;
  selectedLowerQuantile: number | null;
  selectedUpperQuantile: number | null;
  scopeLimit: string;
  errors: string[];
};

export type DirectionalQuantilePowerSpec = {
  schema: "scout.verification-allocation-directional-quantile-power/v1";
  evidenceClass: "synthetic-analysis-fixture";
  calibrationMethod: "exact-trinomial-enumeration";
  effectSupport: [-1, 0, 1];
  directionalDecisionDelta: 0;
  calibrationSpecSha256: string;
  selectedLowerQuantile: number;
  selectedUpperQuantile: number;
  runBlockCount: number;
  minimumCorrectDirectionalPower: number;
  maximumWrongDirectionalProbability: number;
  alternativeProcesses: PercentileAlternativeCalibrationSpec["processes"];
};

export type DirectionalQuantilePowerAnalysis = {
  ok: boolean;
  powerSpecSha256: string;
  calibrationSpecSha256: string;
  calibrationMethod: "exact-trinomial-enumeration" | "";
  monteCarloStandardError: 0 | null;
  runBlockCount: number;
  selectedLowerQuantile: number | null;
  selectedUpperQuantile: number | null;
  report: PercentileAlternativeCalibrationAnalysis["report"];
  scopeLimit: string;
  errors: string[];
};

export type FinitePercentileComparisonAnalysis = {
  ok: boolean;
  decisionAuthority: "exact-trinomial-oracle" | "";
  finiteDecisionRole: "diagnostic-comparison-only" | "";
  comparisonSpecSha256: string;
  calibrationSpecSha256: string;
  bootstrapSpecSha256: string;
  modelId: string;
  runBlockCount: number;
  compositionCount: number;
  decisionMismatchCount: number;
  mismatchExamples: Array<{
    negativeCount: number;
    zeroCount: number;
    positiveCount: number;
    exactDecision: PracticalEffectDecision;
    finiteDecision: PracticalEffectDecision;
  }>;
  processes: Array<{
    processId: string;
    exactFalseDirectionalProbability: number;
    finiteFalseDirectionalProbability: number;
    authoritativeFalseDirectionalProbability: number;
    passesAuthoritativeTolerance: boolean;
    decisionMismatchProbability: number;
    finiteDirectionalExactNonDirectionalProbability: number;
    exactDirectionalFiniteNonDirectionalProbability: number;
    remainingDecisionMismatchProbability: number;
  }>;
  scopeLimit: string;
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

export const TOY_BLOCK_BOOTSTRAP_SEED_SHA256 =
  "b33363aee6fc701c2006d91356525e4a5abbd4386129fc4b90e9c78569e086b3";

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
  let encodedBundle: string | undefined;
  try {
    encodedBundle = JSON.stringify(candidate);
  } catch {
    return invalidBundleAnalysis(["result bundle is not JSON serializable"]);
  }
  if (typeof encodedBundle !== "string") {
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

export function buildToyModelRunBlockBootstrapSpec(): ModelRunBlockBootstrapSpec {
  return {
    schema: "scout.verification-allocation-block-bootstrap/v1",
    evidenceClass: "synthetic-analysis-fixture",
    resamplingUnit: "model-seed-block",
    modelWeighting: "equal-model",
    resamplingSeedSha256: TOY_BLOCK_BOOTSTRAP_SEED_SHA256,
    resamples: 1024,
    lowerQuantile: 0.025,
    upperQuantile: 0.975,
  };
}

export function buildToyPracticalEffectDecisionSpec(): PracticalEffectDecisionSpec {
  return {
    schema: "scout.verification-allocation-practical-decision/v1",
    evidenceClass: "synthetic-analysis-fixture",
    practicalDelta: 0.1,
    intervalRule: "percentile",
    namedModelPolicy: "unanimous",
    conflictPolicy: "inconclusive",
  };
}

export function buildToyPercentileNullCalibrationSpec(): PercentileNullCalibrationSpec {
  return {
    schema: "scout.verification-allocation-null-calibration/v1",
    evidenceClass: "synthetic-analysis-fixture",
    calibrationMethod: "exact-trinomial-enumeration",
    effectSupport: [-1, 0, 1],
    practicalDelta: 0.1,
    lowerQuantile: 0.025,
    upperQuantile: 0.975,
    falseDirectionalTolerance: 0.01,
    candidateMinimumRunBlocks: 64,
    verificationMaximumRunBlocks: 96,
    reportRunBlockCounts: [2, 4, 8, 16, 25, 32, 48, 64, 96],
    processes: [
      { id: "balanced-null", probabilities: [0.25, 0.5, 0.25] },
      { id: "dense-null", probabilities: [0.5, 0, 0.5] },
      { id: "sparse-null", probabilities: [0.1, 0.8, 0.1] },
    ],
  };
}

export function buildToyPercentileAlternativeCalibrationSpec(): PercentileAlternativeCalibrationSpec {
  return {
    schema: "scout.verification-allocation-alternative-calibration/v1",
    evidenceClass: "synthetic-analysis-fixture",
    calibrationMethod: "exact-trinomial-enumeration",
    effectSupport: [-1, 0, 1],
    practicalDelta: 0.1,
    lowerQuantile: 0.025,
    upperQuantile: 0.975,
    runBlockCount: 64,
    minimumCorrectDirectionalPower: 0.8,
    maximumWrongDirectionalProbability: 0.01,
    processes: [
      {
        id: "moderate-positive",
        pairId: "moderate",
        expectedDirection: "positive",
        probabilities: [0.2, 0.45, 0.35],
      },
      {
        id: "moderate-negative",
        pairId: "moderate",
        expectedDirection: "negative",
        probabilities: [0.35, 0.45, 0.2],
      },
      {
        id: "strong-positive",
        pairId: "strong",
        expectedDirection: "positive",
        probabilities: [0.15, 0.4, 0.45],
      },
      {
        id: "strong-negative",
        pairId: "strong",
        expectedDirection: "negative",
        probabilities: [0.45, 0.4, 0.15],
      },
    ],
  };
}

export function buildToyPercentileAlternativePowerSearchSpec(): PercentileAlternativePowerSearchSpec {
  const {
    schema: _schema,
    runBlockCount: _runBlockCount,
    ...calibration
  } = buildToyPercentileAlternativeCalibrationSpec();
  return {
    ...calibration,
    schema: "scout.verification-allocation-alternative-power-search/v1",
    minimumRunBlockCount: 64,
    maximumRunBlockCount: 256,
    reportRunBlockCounts: [64, 96, 128, 192, 256],
  };
}

export function buildToyPercentileUnanimousPowerSpec(): PercentileUnanimousPowerSpec {
  return {
    schema: "scout.verification-allocation-unanimous-power/v1",
    evidenceClass: "synthetic-analysis-fixture",
    dependenceTreatment: "unknown-frechet-bounds-with-independent-illustration",
    modelCount: 6,
    minimumUnanimousCorrectDirectionalPower: 0.8,
    perModelCalibration: {
      ...buildToyPercentileAlternativeCalibrationSpec(),
      runBlockCount: 105,
    },
  };
}

export function buildToyPercentileEstimandComparisonSpec(): PercentileEstimandComparisonSpec {
  const nullCalibration = buildToyPercentileNullCalibrationSpec();
  const alternativeCalibration = buildToyPercentileAlternativeCalibrationSpec();
  return {
    schema: "scout.verification-allocation-estimand-comparison/v1",
    evidenceClass: "synthetic-analysis-fixture",
    calibrationMethod: "exact-trinomial-enumeration",
    effectSupport: [-1, 0, 1],
    directionalDecisionDelta: 0,
    practicalDecisionDelta: alternativeCalibration.practicalDelta,
    lowerQuantile: alternativeCalibration.lowerQuantile,
    upperQuantile: alternativeCalibration.upperQuantile,
    runBlockCount: 105,
    minimumCorrectDirectionalPower:
      alternativeCalibration.minimumCorrectDirectionalPower,
    maximumWrongDirectionalProbability:
      alternativeCalibration.maximumWrongDirectionalProbability,
    nullProcesses: nullCalibration.processes,
    alternativeProcesses: alternativeCalibration.processes,
  };
}

export function buildToyDirectionalQuantileCalibrationSpec(): DirectionalQuantileCalibrationSpec {
  const nullCalibration = buildToyPercentileNullCalibrationSpec();
  return {
    schema: "scout.verification-allocation-directional-quantile-calibration/v1",
    evidenceClass: "synthetic-analysis-fixture",
    calibrationMethod: "exact-trinomial-enumeration",
    effectSupport: [-1, 0, 1],
    directionalDecisionDelta: 0,
    runBlockCount: 105,
    candidateLowerQuantiles: [0.025, 0.01, 0.005, 0.0025],
    selectionPolicy: "first-passing-all-nulls",
    maximumFalseDirectionalProbability: 0.01,
    nullProcesses: nullCalibration.processes,
  };
}

export function buildToyDirectionalQuantilePowerSpec(
  calibration: DirectionalQuantileCalibrationAnalysis,
): DirectionalQuantilePowerSpec {
  if (
    !calibration.ok ||
    calibration.selectedLowerQuantile === null ||
    calibration.selectedUpperQuantile === null
  ) {
    throw new Error(
      "directional quantile calibration did not select an interval",
    );
  }
  const alternativeCalibration = buildToyPercentileAlternativeCalibrationSpec();
  return {
    schema: "scout.verification-allocation-directional-quantile-power/v1",
    evidenceClass: "synthetic-analysis-fixture",
    calibrationMethod: "exact-trinomial-enumeration",
    effectSupport: [-1, 0, 1],
    directionalDecisionDelta: 0,
    calibrationSpecSha256: calibration.calibrationSpecSha256,
    selectedLowerQuantile: calibration.selectedLowerQuantile,
    selectedUpperQuantile: calibration.selectedUpperQuantile,
    runBlockCount: calibration.runBlockCount,
    minimumCorrectDirectionalPower:
      alternativeCalibration.minimumCorrectDirectionalPower,
    maximumWrongDirectionalProbability:
      alternativeCalibration.maximumWrongDirectionalProbability,
    alternativeProcesses: alternativeCalibration.processes,
  };
}

function invalidBootstrapAnalysis(
  errors: string[],
): ModelRunBlockBootstrapAnalysis {
  return {
    ok: false,
    bundleSha256: "",
    scheduleSha256: "",
    bootstrapSpecSha256: "",
    resamplingUnit: "",
    models: [],
    equalModel: [],
    errors,
  };
}

function parseModelRunBlockBootstrapSpec(
  candidate: unknown,
): ModelRunBlockBootstrapSpec | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    return null;
  const spec = candidate as Record<string, unknown>;
  if (
    Object.keys(spec).sort().join(",") !==
      "evidenceClass,lowerQuantile,modelWeighting,resamples,resamplingSeedSha256,resamplingUnit,schema,upperQuantile" ||
    spec.schema !== "scout.verification-allocation-block-bootstrap/v1" ||
    spec.evidenceClass !== "synthetic-analysis-fixture" ||
    spec.resamplingUnit !== "model-seed-block" ||
    spec.modelWeighting !== "equal-model" ||
    typeof spec.resamplingSeedSha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(spec.resamplingSeedSha256) ||
    !Number.isInteger(spec.resamples) ||
    (spec.resamples as number) < 100 ||
    (spec.resamples as number) > 100_000 ||
    typeof spec.lowerQuantile !== "number" ||
    !Number.isFinite(spec.lowerQuantile) ||
    spec.lowerQuantile <= 0 ||
    spec.lowerQuantile >= 0.5 ||
    typeof spec.upperQuantile !== "number" ||
    !Number.isFinite(spec.upperQuantile) ||
    spec.upperQuantile <= 0.5 ||
    spec.upperQuantile >= 1
  ) {
    return null;
  }
  return spec as ModelRunBlockBootstrapSpec;
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function empiricalQuantile(values: number[], quantile: number): number {
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.max(
    0,
    Math.min(ordered.length - 1, Math.ceil(quantile * ordered.length) - 1),
  );
  return ordered[index]!;
}

function deterministicBlockIndex(
  seedSha256: string,
  replicate: number,
  modelId: string,
  draw: number,
  blockCount: number,
): number {
  const digest = createHash("sha256")
    .update(`${seedSha256}/${replicate}/${modelId}/${draw}`)
    .digest();
  return digest.readUInt32BE(0) % blockCount;
}

/**
 * Resample complete model/seed run blocks within each declared model, then
 * combine models with equal weight. The named model set remains fixed. This is
 * a deterministic synthetic inference fixture, not a provider run or a claim
 * of generalization to models outside the schedule.
 */
export function bootstrapFactorialModelRunBlocks(
  schedule: FactorialSchedule,
  resultBundle: unknown,
  bootstrapSpecCandidate: unknown,
): ModelRunBlockBootstrapAnalysis {
  const spec = parseModelRunBlockBootstrapSpec(bootstrapSpecCandidate);
  if (!spec) {
    return invalidBootstrapAnalysis([
      "model/run block bootstrap specification is invalid",
    ]);
  }
  const bundleAnalysis = analyzeFactorialResultBundle(schedule, resultBundle);
  if (!bundleAnalysis.ok) {
    return invalidBootstrapAnalysis(
      bundleAnalysis.errors.map((error) => `result bundle: ${error}`),
    );
  }
  const bundle = resultBundle as FactorialResultBundle;
  const episodeById = new Map(
    schedule.episodes.map((episode) => [episode.id, episode]),
  );
  const blockEffects = schedule.models.map((modelId) => {
    const blocks = schedule.seeds
      .map((seedId) => {
        const blockSchedule: FactorialSchedule = {
          ...schedule,
          models: [modelId],
          seeds: [seedId],
          episodes: schedule.episodes.filter(
            (episode) =>
              episode.modelId === modelId && episode.seedId === seedId,
          ),
        };
        const blockOutcomes = bundle.outcomes.filter((outcome) => {
          const episode = episodeById.get(outcome.episodeId);
          return episode?.modelId === modelId && episode.seedId === seedId;
        });
        const analysis = analyzeFactorialOutcomes(blockSchedule, blockOutcomes);
        return analysis.strata.map((stratum) => stratum.deltaStatus);
      })
      .sort((left, right) => {
        for (let index = 0; index < left.length; index += 1) {
          if (left[index] !== right[index]) return left[index]! - right[index]!;
        }
        return 0;
      });
    return { modelId, blocks };
  });

  const modelReplicates = blockEffects.map(({ modelId, blocks }) => {
    const strata = bundleAnalysis.pooled!.strata.map((_, stratumIndex) =>
      Array.from({ length: spec.resamples }, (_, replicate) =>
        mean(
          Array.from({ length: blocks.length }, (_, draw) => {
            const blockIndex = deterministicBlockIndex(
              spec.resamplingSeedSha256,
              replicate,
              modelId,
              draw,
              blocks.length,
            );
            return blocks[blockIndex]![stratumIndex]!;
          }),
        ),
      ),
    );
    return { modelId, blocks, strata };
  });

  const models = modelReplicates.map(({ modelId, blocks, strata }) => ({
    modelId,
    runBlockCount: blocks.length,
    strata: bundleAnalysis.pooled!.strata.map((stratum, stratumIndex) => {
      const pointEstimate = mean(blocks.map((block) => block[stratumIndex]!));
      return {
        plan: stratum.plan,
        temptation: stratum.temptation,
        pointEstimate,
        lower: empiricalQuantile(strata[stratumIndex]!, spec.lowerQuantile),
        upper: empiricalQuantile(strata[stratumIndex]!, spec.upperQuantile),
      };
    }),
  }));

  const equalModel = bundleAnalysis.pooled!.strata.map(
    (stratum, stratumIndex) => {
      const modelPoints = models.map(
        (model) => model.strata[stratumIndex]!.pointEstimate,
      );
      const replicates = Array.from(
        { length: spec.resamples },
        (_, replicate) =>
          mean(
            modelReplicates.map(
              (model) => model.strata[stratumIndex]![replicate]!,
            ),
          ),
      );
      const modelMinimum = Math.min(...modelPoints);
      const modelMaximum = Math.max(...modelPoints);
      return {
        plan: stratum.plan,
        temptation: stratum.temptation,
        modelCount: models.length,
        pointEstimate: mean(modelPoints),
        lower: empiricalQuantile(replicates, spec.lowerQuantile),
        upper: empiricalQuantile(replicates, spec.upperQuantile),
        modelMinimum,
        modelMaximum,
        directionConflict: modelMinimum < 0 && modelMaximum > 0,
      };
    },
  );

  return {
    ok: true,
    bundleSha256: bundleAnalysis.bundleSha256,
    scheduleSha256: bundleAnalysis.scheduleSha256,
    bootstrapSpecSha256: createHash("sha256")
      .update(JSON.stringify(spec))
      .digest("hex"),
    resamplingUnit: spec.resamplingUnit,
    models,
    equalModel,
    errors: [],
  };
}

function invalidPracticalDecisionAnalysis(
  errors: string[],
): PracticalEffectDecisionAnalysis {
  return {
    ok: false,
    scheduleSha256: "",
    bundleSha256: "",
    bootstrapSpecSha256: "",
    decisionSpecSha256: "",
    strata: [],
    errors,
  };
}

function parsePracticalEffectDecisionSpec(
  candidate: unknown,
): PracticalEffectDecisionSpec | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    return null;
  const spec = candidate as Record<string, unknown>;
  if (
    Object.keys(spec).sort().join(",") !==
      "conflictPolicy,evidenceClass,intervalRule,namedModelPolicy,practicalDelta,schema" ||
    spec.schema !== "scout.verification-allocation-practical-decision/v1" ||
    spec.evidenceClass !== "synthetic-analysis-fixture" ||
    typeof spec.practicalDelta !== "number" ||
    !Number.isFinite(spec.practicalDelta) ||
    spec.practicalDelta <= 0 ||
    spec.practicalDelta >= 1 ||
    spec.intervalRule !== "percentile" ||
    spec.namedModelPolicy !== "unanimous" ||
    spec.conflictPolicy !== "inconclusive"
  ) {
    return null;
  }
  return spec as PracticalEffectDecisionSpec;
}

function classifyPracticalInterval(
  lower: number,
  upper: number,
  practicalDelta: number,
): PracticalEffectDecision {
  if (lower > practicalDelta) return "positive";
  if (upper < -practicalDelta) return "negative";
  if (lower >= -practicalDelta && upper <= practicalDelta) return "negligible";
  return "inconclusive";
}

/**
 * Apply a frozen practical-effect rule to the schedule-bound block bootstrap.
 * A pooled interval cannot decide the result unless every named model has the
 * same conclusive classification. This remains synthetic decision tooling.
 */
export function decideFactorialPracticalEffects(
  schedule: FactorialSchedule,
  resultBundle: unknown,
  bootstrapSpec: unknown,
  decisionSpecCandidate: unknown,
): PracticalEffectDecisionAnalysis {
  const decisionSpec = parsePracticalEffectDecisionSpec(decisionSpecCandidate);
  if (!decisionSpec) {
    return invalidPracticalDecisionAnalysis([
      "practical-effect decision specification is invalid",
    ]);
  }
  const bootstrap = bootstrapFactorialModelRunBlocks(
    schedule,
    resultBundle,
    bootstrapSpec,
  );
  if (!bootstrap.ok) {
    return invalidPracticalDecisionAnalysis(
      bootstrap.errors.map((error) => `block bootstrap: ${error}`),
    );
  }

  const strata = bootstrap.equalModel.map((aggregate, stratumIndex) => {
    const modelDecisions = bootstrap.models.map((model) => ({
      modelId: model.modelId,
      decision: classifyPracticalInterval(
        model.strata[stratumIndex]!.lower,
        model.strata[stratumIndex]!.upper,
        decisionSpec.practicalDelta,
      ),
    }));
    const aggregateIntervalDecision = classifyPracticalInterval(
      aggregate.lower,
      aggregate.upper,
      decisionSpec.practicalDelta,
    );
    const namedDecisions = new Set(
      modelDecisions.map((model) => model.decision),
    );
    let decision: PracticalEffectDecision = "inconclusive";
    let reason = "named-model intervals are inconclusive";

    if (aggregate.directionConflict) {
      reason = "named-model point estimates have opposing directions";
    } else if (
      modelDecisions.some((model) => model.decision === "inconclusive")
    ) {
      reason = "at least one named-model interval is inconclusive";
    } else if (namedDecisions.size !== 1) {
      reason = "named-model practical-effect decisions disagree";
    } else {
      const unanimousDecision = modelDecisions[0]!.decision;
      if (aggregateIntervalDecision !== unanimousDecision) {
        reason =
          "aggregate interval does not support the unanimous model decision";
      } else {
        decision = unanimousDecision;
        reason = "aggregate and all named-model intervals agree";
      }
    }

    return {
      plan: aggregate.plan,
      temptation: aggregate.temptation,
      modelDecisions,
      aggregateIntervalDecision,
      decision,
      reason,
    };
  });

  return {
    ok: true,
    scheduleSha256: bootstrap.scheduleSha256,
    bundleSha256: bootstrap.bundleSha256,
    bootstrapSpecSha256: bootstrap.bootstrapSpecSha256,
    decisionSpecSha256: createHash("sha256")
      .update(JSON.stringify(decisionSpec))
      .digest("hex"),
    strata,
    errors: [],
  };
}

function invalidPercentileNullCalibrationAnalysis(
  errors: string[],
): PercentileNullCalibrationAnalysis {
  return {
    ok: false,
    calibrationSpecSha256: "",
    calibrationMethod: "",
    monteCarloStandardError: null,
    supportedCandidateMinimumRunBlocks: null,
    report: [],
    verificationWorstCases: [],
    scopeLimit: "",
    errors,
  };
}

function parsePercentileNullCalibrationSpec(
  candidate: unknown,
): PercentileNullCalibrationSpec | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    return null;
  const spec = candidate as Record<string, unknown>;
  if (
    Object.keys(spec).sort().join(",") !==
      "calibrationMethod,candidateMinimumRunBlocks,effectSupport,evidenceClass,falseDirectionalTolerance,lowerQuantile,practicalDelta,processes,reportRunBlockCounts,schema,upperQuantile,verificationMaximumRunBlocks" ||
    spec.schema !== "scout.verification-allocation-null-calibration/v1" ||
    spec.evidenceClass !== "synthetic-analysis-fixture" ||
    spec.calibrationMethod !== "exact-trinomial-enumeration" ||
    JSON.stringify(spec.effectSupport) !== "[-1,0,1]" ||
    typeof spec.practicalDelta !== "number" ||
    !Number.isFinite(spec.practicalDelta) ||
    spec.practicalDelta <= 0 ||
    spec.practicalDelta >= 1 ||
    typeof spec.lowerQuantile !== "number" ||
    !Number.isFinite(spec.lowerQuantile) ||
    spec.lowerQuantile <= 0 ||
    spec.lowerQuantile >= 0.5 ||
    typeof spec.upperQuantile !== "number" ||
    !Number.isFinite(spec.upperQuantile) ||
    spec.upperQuantile <= 0.5 ||
    spec.upperQuantile >= 1 ||
    typeof spec.falseDirectionalTolerance !== "number" ||
    !Number.isFinite(spec.falseDirectionalTolerance) ||
    spec.falseDirectionalTolerance <= 0 ||
    spec.falseDirectionalTolerance >= 0.5 ||
    !Number.isInteger(spec.candidateMinimumRunBlocks) ||
    (spec.candidateMinimumRunBlocks as number) < 2 ||
    !Number.isInteger(spec.verificationMaximumRunBlocks) ||
    (spec.verificationMaximumRunBlocks as number) <
      (spec.candidateMinimumRunBlocks as number) ||
    (spec.verificationMaximumRunBlocks as number) > 256 ||
    !Array.isArray(spec.reportRunBlockCounts) ||
    spec.reportRunBlockCounts.length === 0 ||
    !Array.isArray(spec.processes) ||
    spec.processes.length === 0
  ) {
    return null;
  }

  const reportRunBlockCounts = spec.reportRunBlockCounts as unknown[];
  if (
    reportRunBlockCounts.some(
      (count) =>
        !Number.isInteger(count) ||
        (count as number) < 2 ||
        (count as number) > (spec.verificationMaximumRunBlocks as number),
    ) ||
    new Set(reportRunBlockCounts).size !== reportRunBlockCounts.length ||
    !reportRunBlockCounts.includes(spec.candidateMinimumRunBlocks) ||
    !reportRunBlockCounts.includes(spec.verificationMaximumRunBlocks)
  ) {
    return null;
  }

  const processes = spec.processes as unknown[];
  const processIds = new Set<string>();
  for (const candidateProcess of processes) {
    if (
      !candidateProcess ||
      typeof candidateProcess !== "object" ||
      Array.isArray(candidateProcess)
    ) {
      return null;
    }
    const process = candidateProcess as Record<string, unknown>;
    if (
      Object.keys(process).sort().join(",") !== "id,probabilities" ||
      typeof process.id !== "string" ||
      !/^[a-z][a-z0-9-]*$/.test(process.id) ||
      processIds.has(process.id) ||
      !Array.isArray(process.probabilities) ||
      process.probabilities.length !== 3
    ) {
      return null;
    }
    const probabilities = process.probabilities as unknown[];
    if (
      probabilities.some(
        (probability) =>
          typeof probability !== "number" ||
          !Number.isFinite(probability) ||
          probability < 0 ||
          probability > 1,
      )
    ) {
      return null;
    }
    const [negative, zero, positive] = probabilities as number[];
    if (
      Math.abs(negative - positive) > 1e-12 ||
      Math.abs(negative + zero + positive - 1) > 1e-12
    ) {
      return null;
    }
    processIds.add(process.id);
  }
  return spec as unknown as PercentileNullCalibrationSpec;
}

function exactMultinomialProbability(
  runBlockCount: number,
  negativeCount: number,
  zeroCount: number,
  positiveCount: number,
  probabilities: [number, number, number],
  logFactorials: number[],
): number {
  const counts = [negativeCount, zeroCount, positiveCount];
  if (counts.some((count, index) => count > 0 && probabilities[index] === 0))
    return 0;
  let logProbability =
    logFactorials[runBlockCount]! -
    logFactorials[negativeCount]! -
    logFactorials[zeroCount]! -
    logFactorials[positiveCount]!;
  for (let index = 0; index < counts.length; index += 1) {
    if (counts[index]! > 0) {
      logProbability += counts[index]! * Math.log(probabilities[index]!);
    }
  }
  return Math.exp(logProbability);
}

function exactTrinomialPercentileDecision(
  runBlockCount: number,
  negativeCount: number,
  zeroCount: number,
  positiveCount: number,
  lowerQuantile: number,
  upperQuantile: number,
  practicalDelta: number,
): PracticalEffectDecision {
  const probabilities = [
    negativeCount / runBlockCount,
    zeroCount / runBlockCount,
    positiveCount / runBlockCount,
  ];
  let distribution = new Float64Array(2 * runBlockCount + 1);
  distribution[runBlockCount] = 1;
  for (let draw = 0; draw < runBlockCount; draw += 1) {
    const next = new Float64Array(2 * runBlockCount + 1);
    for (
      let index = runBlockCount - draw;
      index <= runBlockCount + draw;
      index += 1
    ) {
      const probability = distribution[index]!;
      if (probability === 0) continue;
      next[index - 1]! += probability * probabilities[0]!;
      next[index]! += probability * probabilities[1]!;
      next[index + 1]! += probability * probabilities[2]!;
    }
    distribution = next;
  }

  const quantile = (target: number): number => {
    let cumulative = 0;
    for (let index = 0; index < distribution.length; index += 1) {
      cumulative += distribution[index]!;
      if (cumulative >= target) return (index - runBlockCount) / runBlockCount;
    }
    return 1;
  };
  return classifyPracticalInterval(
    quantile(lowerQuantile),
    quantile(upperQuantile),
    practicalDelta,
  );
}

/**
 * Enumerate the exact sampling distribution and exact nonparametric
 * percentile-bootstrap distribution for frozen symmetric trinomial nulls.
 * This avoids Monte Carlo error, but it does not calibrate the separate
 * finite-resample implementation or any process outside the declared family.
 */
export function calibratePercentileNullProcesses(
  candidate: unknown,
): PercentileNullCalibrationAnalysis {
  const spec = parsePercentileNullCalibrationSpec(candidate);
  if (!spec) {
    return invalidPercentileNullCalibrationAnalysis([
      "percentile null calibration specification is invalid",
    ]);
  }
  const countsToEvaluate = new Set(spec.reportRunBlockCounts);
  for (
    let count = spec.candidateMinimumRunBlocks;
    count <= spec.verificationMaximumRunBlocks;
    count += 1
  ) {
    countsToEvaluate.add(count);
  }
  const orderedCounts = [...countsToEvaluate].sort(
    (left, right) => left - right,
  );
  const logFactorials = [0];
  for (let count = 1; count <= spec.verificationMaximumRunBlocks; count += 1) {
    logFactorials[count] = logFactorials[count - 1]! + Math.log(count);
  }

  const rates = new Map<
    string,
    {
      falsePositiveDirectionProbability: number;
      falseNegativeDirectionProbability: number;
    }
  >();
  for (const runBlockCount of orderedCounts) {
    for (const process of spec.processes) {
      rates.set(`${process.id}/${runBlockCount}`, {
        falsePositiveDirectionProbability: 0,
        falseNegativeDirectionProbability: 0,
      });
    }
    for (
      let negativeCount = 0;
      negativeCount <= runBlockCount;
      negativeCount += 1
    ) {
      for (
        let zeroCount = 0;
        zeroCount <= runBlockCount - negativeCount;
        zeroCount += 1
      ) {
        const positiveCount = runBlockCount - negativeCount - zeroCount;
        const decision = exactTrinomialPercentileDecision(
          runBlockCount,
          negativeCount,
          zeroCount,
          positiveCount,
          spec.lowerQuantile,
          spec.upperQuantile,
          spec.practicalDelta,
        );
        if (decision !== "positive" && decision !== "negative") continue;
        for (const process of spec.processes) {
          const probability = exactMultinomialProbability(
            runBlockCount,
            negativeCount,
            zeroCount,
            positiveCount,
            process.probabilities,
            logFactorials,
          );
          const rate = rates.get(`${process.id}/${runBlockCount}`)!;
          if (decision === "positive") {
            rate.falsePositiveDirectionProbability += probability;
          } else {
            rate.falseNegativeDirectionProbability += probability;
          }
        }
      }
    }
  }

  const report = spec.processes.flatMap((process) =>
    spec.reportRunBlockCounts.map((runBlockCount) => {
      const rate = rates.get(`${process.id}/${runBlockCount}`)!;
      const falseDirectionalProbability =
        rate.falsePositiveDirectionProbability +
        rate.falseNegativeDirectionProbability;
      return {
        processId: process.id,
        runBlockCount,
        ...rate,
        falseDirectionalProbability,
        passesTolerance:
          falseDirectionalProbability <= spec.falseDirectionalTolerance,
      };
    }),
  );
  const verificationWorstCases = spec.processes.map((process) => {
    let worst = {
      processId: process.id,
      runBlockCount: spec.candidateMinimumRunBlocks,
      falseDirectionalProbability: -1,
    };
    for (
      let runBlockCount = spec.candidateMinimumRunBlocks;
      runBlockCount <= spec.verificationMaximumRunBlocks;
      runBlockCount += 1
    ) {
      const rate = rates.get(`${process.id}/${runBlockCount}`)!;
      const falseDirectionalProbability =
        rate.falsePositiveDirectionProbability +
        rate.falseNegativeDirectionProbability;
      if (falseDirectionalProbability > worst.falseDirectionalProbability) {
        worst = {
          processId: process.id,
          runBlockCount,
          falseDirectionalProbability,
        };
      }
    }
    return worst;
  });
  const candidatePasses = verificationWorstCases.every(
    (worst) =>
      worst.falseDirectionalProbability <= spec.falseDirectionalTolerance,
  );

  return {
    ok: true,
    calibrationSpecSha256: createHash("sha256")
      .update(JSON.stringify(spec))
      .digest("hex"),
    calibrationMethod: spec.calibrationMethod,
    monteCarloStandardError: 0,
    supportedCandidateMinimumRunBlocks: candidatePasses
      ? spec.candidateMinimumRunBlocks
      : null,
    report,
    verificationWorstCases,
    scopeLimit:
      "Exact only for the declared symmetric trinomial nulls and run counts through the verification maximum; the separate finite-resample implementation and real model behavior remain uncalibrated.",
    errors: [],
  };
}

function invalidPercentileAlternativeCalibrationAnalysis(
  errors: string[],
): PercentileAlternativeCalibrationAnalysis {
  return {
    ok: false,
    calibrationSpecSha256: "",
    calibrationMethod: "",
    monteCarloStandardError: null,
    runBlockCount: 0,
    report: [],
    scopeLimit: "",
    errors,
  };
}

function parsePercentileAlternativeCalibrationSpec(
  candidate: unknown,
): PercentileAlternativeCalibrationSpec | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    return null;
  const spec = candidate as Record<string, unknown>;
  if (
    Object.keys(spec).sort().join(",") !==
      "calibrationMethod,effectSupport,evidenceClass,lowerQuantile,maximumWrongDirectionalProbability,minimumCorrectDirectionalPower,practicalDelta,processes,runBlockCount,schema,upperQuantile" ||
    spec.schema !==
      "scout.verification-allocation-alternative-calibration/v1" ||
    spec.evidenceClass !== "synthetic-analysis-fixture" ||
    spec.calibrationMethod !== "exact-trinomial-enumeration" ||
    JSON.stringify(spec.effectSupport) !== "[-1,0,1]" ||
    typeof spec.practicalDelta !== "number" ||
    !Number.isFinite(spec.practicalDelta) ||
    spec.practicalDelta <= 0 ||
    spec.practicalDelta >= 1 ||
    typeof spec.lowerQuantile !== "number" ||
    !Number.isFinite(spec.lowerQuantile) ||
    spec.lowerQuantile <= 0 ||
    spec.lowerQuantile >= 0.5 ||
    typeof spec.upperQuantile !== "number" ||
    !Number.isFinite(spec.upperQuantile) ||
    spec.upperQuantile <= 0.5 ||
    spec.upperQuantile >= 1 ||
    !Number.isInteger(spec.runBlockCount) ||
    (spec.runBlockCount as number) < 2 ||
    (spec.runBlockCount as number) > 256 ||
    typeof spec.minimumCorrectDirectionalPower !== "number" ||
    !Number.isFinite(spec.minimumCorrectDirectionalPower) ||
    spec.minimumCorrectDirectionalPower <= 0 ||
    spec.minimumCorrectDirectionalPower >= 1 ||
    typeof spec.maximumWrongDirectionalProbability !== "number" ||
    !Number.isFinite(spec.maximumWrongDirectionalProbability) ||
    spec.maximumWrongDirectionalProbability <= 0 ||
    spec.maximumWrongDirectionalProbability >= 0.5 ||
    !Array.isArray(spec.processes) ||
    spec.processes.length < 2
  ) {
    return null;
  }

  const processIds = new Set<string>();
  const pairs = new Map<
    string,
    Array<{
      expectedDirection: "positive" | "negative";
      probabilities: [number, number, number];
    }>
  >();
  for (const candidateProcess of spec.processes as unknown[]) {
    if (
      !candidateProcess ||
      typeof candidateProcess !== "object" ||
      Array.isArray(candidateProcess)
    ) {
      return null;
    }
    const process = candidateProcess as Record<string, unknown>;
    if (
      Object.keys(process).sort().join(",") !==
        "expectedDirection,id,pairId,probabilities" ||
      typeof process.id !== "string" ||
      !/^[a-z][a-z0-9-]*$/.test(process.id) ||
      processIds.has(process.id) ||
      typeof process.pairId !== "string" ||
      !/^[a-z][a-z0-9-]*$/.test(process.pairId) ||
      (process.expectedDirection !== "positive" &&
        process.expectedDirection !== "negative") ||
      !Array.isArray(process.probabilities) ||
      process.probabilities.length !== 3
    ) {
      return null;
    }
    const probabilities = process.probabilities as unknown[];
    if (
      probabilities.some(
        (probability) =>
          typeof probability !== "number" ||
          !Number.isFinite(probability) ||
          probability < 0 ||
          probability > 1,
      )
    ) {
      return null;
    }
    const [negative, zero, positive] = probabilities as [
      number,
      number,
      number,
    ];
    const expectedEffect = positive - negative;
    if (
      Math.abs(negative + zero + positive - 1) > 1e-12 ||
      (process.expectedDirection === "positive" &&
        expectedEffect <= (spec.practicalDelta as number)) ||
      (process.expectedDirection === "negative" &&
        expectedEffect >= -(spec.practicalDelta as number))
    ) {
      return null;
    }
    processIds.add(process.id);
    const pair = pairs.get(process.pairId) ?? [];
    pair.push({
      expectedDirection: process.expectedDirection,
      probabilities: [negative, zero, positive],
    });
    pairs.set(process.pairId, pair);
  }
  if (
    [...pairs.values()].some((pair) => {
      if (pair.length !== 2) return true;
      const positive = pair.find(
        (entry) => entry.expectedDirection === "positive",
      );
      const negative = pair.find(
        (entry) => entry.expectedDirection === "negative",
      );
      return (
        !positive ||
        !negative ||
        Math.abs(positive.probabilities[0] - negative.probabilities[2]) >
          1e-12 ||
        Math.abs(positive.probabilities[1] - negative.probabilities[1]) >
          1e-12 ||
        Math.abs(positive.probabilities[2] - negative.probabilities[0]) > 1e-12
      );
    })
  ) {
    return null;
  }
  return spec as unknown as PercentileAlternativeCalibrationSpec;
}

/**
 * Enumerate exact decision probabilities for mirror-paired nonzero
 * alternatives at one frozen run-block count. This measures power for the
 * declared synthetic family and does not authorize provider execution.
 */
export function calibratePercentileAlternativeProcesses(
  candidate: unknown,
): PercentileAlternativeCalibrationAnalysis {
  const spec = parsePercentileAlternativeCalibrationSpec(candidate);
  if (!spec) {
    return invalidPercentileAlternativeCalibrationAnalysis([
      "percentile alternative calibration specification is invalid",
    ]);
  }
  const logFactorials = [0];
  for (let count = 1; count <= spec.runBlockCount; count += 1) {
    logFactorials[count] = logFactorials[count - 1]! + Math.log(count);
  }
  const rates = new Map(
    spec.processes.map((process) => [
      process.id,
      { positive: 0, negative: 0, negligible: 0, inconclusive: 0 },
    ]),
  );
  for (
    let negativeCount = 0;
    negativeCount <= spec.runBlockCount;
    negativeCount += 1
  ) {
    for (
      let zeroCount = 0;
      zeroCount <= spec.runBlockCount - negativeCount;
      zeroCount += 1
    ) {
      const positiveCount = spec.runBlockCount - negativeCount - zeroCount;
      const decision = exactTrinomialPercentileDecision(
        spec.runBlockCount,
        negativeCount,
        zeroCount,
        positiveCount,
        spec.lowerQuantile,
        spec.upperQuantile,
        spec.practicalDelta,
      );
      for (const process of spec.processes) {
        rates.get(process.id)![decision] += exactMultinomialProbability(
          spec.runBlockCount,
          negativeCount,
          zeroCount,
          positiveCount,
          process.probabilities,
          logFactorials,
        );
      }
    }
  }

  return {
    ok: true,
    calibrationSpecSha256: createHash("sha256")
      .update(JSON.stringify(spec))
      .digest("hex"),
    calibrationMethod: spec.calibrationMethod,
    monteCarloStandardError: 0,
    runBlockCount: spec.runBlockCount,
    report: spec.processes.map((process) => {
      const rate = rates.get(process.id)!;
      const correctDirectionalProbability = rate[process.expectedDirection];
      const wrongDirectionalProbability =
        rate[
          process.expectedDirection === "positive" ? "negative" : "positive"
        ];
      return {
        processId: process.id,
        pairId: process.pairId,
        expectedDirection: process.expectedDirection,
        expectedEffect: process.probabilities[2] - process.probabilities[0],
        correctDirectionalProbability,
        wrongDirectionalProbability,
        negligibleProbability: rate.negligible,
        inconclusiveProbability: rate.inconclusive,
        passesPowerTarget:
          correctDirectionalProbability >= spec.minimumCorrectDirectionalPower,
        passesWrongDirectionTolerance:
          wrongDirectionalProbability <=
          spec.maximumWrongDirectionalProbability,
      };
    }),
    scopeLimit:
      "Exact only for the declared mirror-paired trinomial alternatives at the frozen run count; other effects, dependence, drift, power targets, finite resampling, and real models remain uncalibrated.",
    errors: [],
  };
}

function invalidPercentileAlternativePowerSearchAnalysis(
  errors: string[],
): PercentileAlternativePowerSearchAnalysis {
  return {
    ok: false,
    searchSpecSha256: "",
    calibrationMethod: "",
    monteCarloStandardError: null,
    scannedRunBlockCounts: null,
    pairs: [],
    report: [],
    scopeLimit: "",
    errors,
  };
}

function parsePercentileAlternativePowerSearchSpec(
  candidate: unknown,
): PercentileAlternativePowerSearchSpec | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    return null;
  const spec = candidate as Record<string, unknown>;
  if (
    Object.keys(spec).sort().join(",") !==
      "calibrationMethod,effectSupport,evidenceClass,lowerQuantile,maximumRunBlockCount,maximumWrongDirectionalProbability,minimumCorrectDirectionalPower,minimumRunBlockCount,practicalDelta,processes,reportRunBlockCounts,schema,upperQuantile" ||
    spec.schema !==
      "scout.verification-allocation-alternative-power-search/v1" ||
    !Number.isInteger(spec.minimumRunBlockCount) ||
    (spec.minimumRunBlockCount as number) < 2 ||
    !Number.isInteger(spec.maximumRunBlockCount) ||
    (spec.maximumRunBlockCount as number) <
      (spec.minimumRunBlockCount as number) ||
    (spec.maximumRunBlockCount as number) > 256 ||
    !Array.isArray(spec.reportRunBlockCounts) ||
    spec.reportRunBlockCounts.length === 0
  ) {
    return null;
  }
  const reportRunBlockCounts = spec.reportRunBlockCounts as unknown[];
  if (
    reportRunBlockCounts.some(
      (count, index) =>
        !Number.isInteger(count) ||
        (count as number) < (spec.minimumRunBlockCount as number) ||
        (count as number) > (spec.maximumRunBlockCount as number) ||
        (index > 0 &&
          (count as number) <= (reportRunBlockCounts[index - 1] as number)),
    )
  ) {
    return null;
  }

  const calibrationSpec = parsePercentileAlternativeCalibrationSpec({
    schema: "scout.verification-allocation-alternative-calibration/v1",
    evidenceClass: spec.evidenceClass,
    calibrationMethod: spec.calibrationMethod,
    effectSupport: spec.effectSupport,
    practicalDelta: spec.practicalDelta,
    lowerQuantile: spec.lowerQuantile,
    upperQuantile: spec.upperQuantile,
    runBlockCount: spec.minimumRunBlockCount,
    minimumCorrectDirectionalPower: spec.minimumCorrectDirectionalPower,
    maximumWrongDirectionalProbability: spec.maximumWrongDirectionalProbability,
    processes: spec.processes,
  });
  return calibrationSpec
    ? (spec as unknown as PercentileAlternativePowerSearchSpec)
    : null;
}

/**
 * Exhaustively scan every declared run-block count for the frozen,
 * mirror-paired trinomial alternatives. No monotonicity assumption is used:
 * first crossings and observed maxima are derived from every exact count.
 */
export function searchPercentileAlternativePower(
  candidate: unknown,
): PercentileAlternativePowerSearchAnalysis {
  const spec = parsePercentileAlternativePowerSearchSpec(candidate);
  if (!spec) {
    return invalidPercentileAlternativePowerSearchAnalysis([
      "percentile alternative power-search specification is invalid",
    ]);
  }

  const pairIds = [...new Set(spec.processes.map((process) => process.pairId))];
  const pairState = new Map(
    pairIds.map((pairId) => [
      pairId,
      {
        firstPassingRunBlockCount: null as number | null,
        maximumCorrectDirectionalProbability: -1,
        maximumCorrectDirectionalProbabilityRunBlockCount:
          spec.minimumRunBlockCount,
        maximumWrongDirectionalProbability: 0,
      },
    ]),
  );
  const reports = new Map<
    number,
    PercentileAlternativeCalibrationAnalysis["report"]
  >();

  for (
    let runBlockCount = spec.minimumRunBlockCount;
    runBlockCount <= spec.maximumRunBlockCount;
    runBlockCount += 1
  ) {
    const analysis = calibratePercentileAlternativeProcesses({
      schema: "scout.verification-allocation-alternative-calibration/v1",
      evidenceClass: spec.evidenceClass,
      calibrationMethod: spec.calibrationMethod,
      effectSupport: spec.effectSupport,
      practicalDelta: spec.practicalDelta,
      lowerQuantile: spec.lowerQuantile,
      upperQuantile: spec.upperQuantile,
      runBlockCount,
      minimumCorrectDirectionalPower: spec.minimumCorrectDirectionalPower,
      maximumWrongDirectionalProbability:
        spec.maximumWrongDirectionalProbability,
      processes: spec.processes,
    });
    if (!analysis.ok) {
      return invalidPercentileAlternativePowerSearchAnalysis(
        analysis.errors.map((error) => `alternative calibration: ${error}`),
      );
    }
    reports.set(runBlockCount, analysis.report);

    for (const pairId of pairIds) {
      const pair = analysis.report.filter((entry) => entry.pairId === pairId);
      const correctDirectionalProbability = Math.min(
        ...pair.map((entry) => entry.correctDirectionalProbability),
      );
      const wrongDirectionalProbability = Math.max(
        ...pair.map((entry) => entry.wrongDirectionalProbability),
      );
      const state = pairState.get(pairId)!;
      if (
        correctDirectionalProbability >
        state.maximumCorrectDirectionalProbability
      ) {
        state.maximumCorrectDirectionalProbability =
          correctDirectionalProbability;
        state.maximumCorrectDirectionalProbabilityRunBlockCount = runBlockCount;
      }
      state.maximumWrongDirectionalProbability = Math.max(
        state.maximumWrongDirectionalProbability,
        wrongDirectionalProbability,
      );
      if (
        state.firstPassingRunBlockCount === null &&
        pair.every((entry) => entry.passesPowerTarget)
      ) {
        state.firstPassingRunBlockCount = runBlockCount;
      }
    }
  }

  const retainedRunBlockCounts = new Set(spec.reportRunBlockCounts);
  for (const state of pairState.values()) {
    retainedRunBlockCounts.add(
      state.maximumCorrectDirectionalProbabilityRunBlockCount,
    );
    if (state.firstPassingRunBlockCount !== null) {
      retainedRunBlockCounts.add(state.firstPassingRunBlockCount);
      if (state.firstPassingRunBlockCount > spec.minimumRunBlockCount) {
        retainedRunBlockCounts.add(state.firstPassingRunBlockCount - 1);
      }
    }
  }

  return {
    ok: true,
    searchSpecSha256: createHash("sha256")
      .update(JSON.stringify(spec))
      .digest("hex"),
    calibrationMethod: spec.calibrationMethod,
    monteCarloStandardError: 0,
    scannedRunBlockCounts: {
      minimum: spec.minimumRunBlockCount,
      maximum: spec.maximumRunBlockCount,
      total: spec.maximumRunBlockCount - spec.minimumRunBlockCount + 1,
    },
    pairs: pairIds.map((pairId) => {
      const process = spec.processes.find((entry) => entry.pairId === pairId)!;
      const state = pairState.get(pairId)!;
      return {
        pairId,
        expectedEffectMagnitude: Math.abs(
          process.probabilities[2] - process.probabilities[0],
        ),
        ...state,
        passesPowerWithinRange: state.firstPassingRunBlockCount !== null,
      };
    }),
    report: [...retainedRunBlockCounts]
      .sort((left, right) => left - right)
      .map((runBlockCount) => ({
        runBlockCount,
        processes: reports.get(runBlockCount)!,
      })),
    scopeLimit:
      "Exact only for every integer count in the declared bounded search and the frozen mirror-paired trinomial alternatives; the 80% target is synthetic, and other effects, dependence, drift, interval rules, finite resampling, operational cost, and real models remain uncalibrated.",
    errors: [],
  };
}

function invalidPercentileUnanimousPowerAnalysis(
  errors: string[],
): PercentileUnanimousPowerAnalysis {
  return {
    ok: false,
    unanimousPowerSpecSha256: "",
    perModelCalibrationSpecSha256: "",
    dependenceTreatment: "",
    modelCount: 0,
    runBlockCountPerModel: 0,
    requiredPerModelPowerForGuaranteedUnanimity: 0,
    requiredPerModelPowerUnderIndependentIllustration: 0,
    report: [],
    scopeLimit: "",
    errors,
  };
}

function parsePercentileUnanimousPowerSpec(
  candidate: unknown,
): PercentileUnanimousPowerSpec | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    return null;
  const spec = candidate as Record<string, unknown>;
  if (
    Object.keys(spec).sort().join(",") !==
      "dependenceTreatment,evidenceClass,minimumUnanimousCorrectDirectionalPower,modelCount,perModelCalibration,schema" ||
    spec.schema !== "scout.verification-allocation-unanimous-power/v1" ||
    spec.evidenceClass !== "synthetic-analysis-fixture" ||
    spec.dependenceTreatment !==
      "unknown-frechet-bounds-with-independent-illustration" ||
    !Number.isInteger(spec.modelCount) ||
    (spec.modelCount as number) < 2 ||
    (spec.modelCount as number) > 32 ||
    typeof spec.minimumUnanimousCorrectDirectionalPower !== "number" ||
    !Number.isFinite(spec.minimumUnanimousCorrectDirectionalPower) ||
    spec.minimumUnanimousCorrectDirectionalPower <= 0 ||
    spec.minimumUnanimousCorrectDirectionalPower >= 1 ||
    !parsePercentileAlternativeCalibrationSpec(spec.perModelCalibration)
  ) {
    return null;
  }
  return spec as unknown as PercentileUnanimousPowerSpec;
}

function repeatedEventFrechetBounds(
  marginalProbability: number,
  eventCount: number,
): { lower: number; upper: number } {
  return {
    lower: Math.max(0, eventCount * marginalProbability - (eventCount - 1)),
    upper: marginalProbability,
  };
}

/**
 * Lift exact per-model directional probabilities into dependence-honest bounds
 * for unanimity across a fixed named-model set. Independence is reported only
 * as an illustration and never replaces the unknown-dependence lower bound.
 */
export function calibratePercentileUnanimousPower(
  candidate: unknown,
): PercentileUnanimousPowerAnalysis {
  const spec = parsePercentileUnanimousPowerSpec(candidate);
  if (!spec) {
    return invalidPercentileUnanimousPowerAnalysis([
      "percentile unanimous-power specification is invalid",
    ]);
  }
  const perModel = calibratePercentileAlternativeProcesses(
    spec.perModelCalibration,
  );
  if (!perModel.ok) {
    return invalidPercentileUnanimousPowerAnalysis(
      perModel.errors.map((error) => `per-model calibration: ${error}`),
    );
  }
  const target = spec.minimumUnanimousCorrectDirectionalPower;
  const guaranteedMarginalTarget =
    (target + spec.modelCount - 1) / spec.modelCount;
  const independentMarginalTarget = Math.pow(target, 1 / spec.modelCount);

  return {
    ok: true,
    unanimousPowerSpecSha256: createHash("sha256")
      .update(JSON.stringify(spec))
      .digest("hex"),
    perModelCalibrationSpecSha256: perModel.calibrationSpecSha256,
    dependenceTreatment: spec.dependenceTreatment,
    modelCount: spec.modelCount,
    runBlockCountPerModel: spec.perModelCalibration.runBlockCount,
    requiredPerModelPowerForGuaranteedUnanimity: guaranteedMarginalTarget,
    requiredPerModelPowerUnderIndependentIllustration:
      independentMarginalTarget,
    report: perModel.report.map((process) => {
      const correctBounds = repeatedEventFrechetBounds(
        process.correctDirectionalProbability,
        spec.modelCount,
      );
      const wrongBounds = repeatedEventFrechetBounds(
        process.wrongDirectionalProbability,
        spec.modelCount,
      );
      const independentCorrect = Math.pow(
        process.correctDirectionalProbability,
        spec.modelCount,
      );
      const independentWrong = Math.pow(
        process.wrongDirectionalProbability,
        spec.modelCount,
      );
      return {
        processId: process.processId,
        pairId: process.pairId,
        expectedDirection: process.expectedDirection,
        expectedEffect: process.expectedEffect,
        perModelCorrectDirectionalProbability:
          process.correctDirectionalProbability,
        unanimousCorrectDirectionalLowerBound: correctBounds.lower,
        unanimousCorrectDirectionalUpperBound: correctBounds.upper,
        independentCorrectDirectionalIllustration: independentCorrect,
        perModelWrongDirectionalProbability:
          process.wrongDirectionalProbability,
        unanimousWrongDirectionalLowerBound: wrongBounds.lower,
        unanimousWrongDirectionalUpperBound: wrongBounds.upper,
        independentWrongDirectionalIllustration: independentWrong,
        passesGuaranteedUnanimousPowerTarget: correctBounds.lower >= target,
        passesIndependentIllustrationPowerTarget: independentCorrect >= target,
      };
    }),
    scopeLimit:
      "Exact per-model only for the frozen trinomial calibration. Unanimous named-model bounds assume equal marginals but unknown dependence; the independence product is illustrative, and aggregate-interval support, heterogeneous models, provider behavior, and final-gate power remain uncalibrated.",
    errors: [],
  };
}

function invalidPercentileEstimandComparisonAnalysis(
  errors: string[],
): PercentileEstimandComparisonAnalysis {
  return {
    ok: false,
    comparisonSpecSha256: "",
    calibrationMethod: "",
    monteCarloStandardError: null,
    runBlockCount: 0,
    estimands: [],
    scopeLimit: "",
    errors,
  };
}

function parsePercentileEstimandComparisonSpec(
  candidate: unknown,
): PercentileEstimandComparisonSpec | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    return null;
  const spec = candidate as Record<string, unknown>;
  if (
    Object.keys(spec).sort().join(",") !==
      "alternativeProcesses,calibrationMethod,directionalDecisionDelta,effectSupport,evidenceClass,lowerQuantile,maximumWrongDirectionalProbability,minimumCorrectDirectionalPower,nullProcesses,practicalDecisionDelta,runBlockCount,schema,upperQuantile" ||
    spec.schema !== "scout.verification-allocation-estimand-comparison/v1" ||
    spec.evidenceClass !== "synthetic-analysis-fixture" ||
    spec.calibrationMethod !== "exact-trinomial-enumeration" ||
    JSON.stringify(spec.effectSupport) !== "[-1,0,1]" ||
    spec.directionalDecisionDelta !== 0 ||
    typeof spec.practicalDecisionDelta !== "number" ||
    !Number.isFinite(spec.practicalDecisionDelta) ||
    spec.practicalDecisionDelta <= 0 ||
    spec.practicalDecisionDelta >= 1 ||
    !Number.isInteger(spec.runBlockCount) ||
    (spec.runBlockCount as number) < 2 ||
    (spec.runBlockCount as number) > 256
  ) {
    return null;
  }

  const nullSpec = parsePercentileNullCalibrationSpec({
    schema: "scout.verification-allocation-null-calibration/v1",
    evidenceClass: spec.evidenceClass,
    calibrationMethod: spec.calibrationMethod,
    effectSupport: spec.effectSupport,
    practicalDelta: spec.practicalDecisionDelta,
    lowerQuantile: spec.lowerQuantile,
    upperQuantile: spec.upperQuantile,
    falseDirectionalTolerance: spec.maximumWrongDirectionalProbability,
    candidateMinimumRunBlocks: spec.runBlockCount,
    verificationMaximumRunBlocks: spec.runBlockCount,
    reportRunBlockCounts: [spec.runBlockCount],
    processes: spec.nullProcesses,
  });
  const alternativeSpec = parsePercentileAlternativeCalibrationSpec({
    schema: "scout.verification-allocation-alternative-calibration/v1",
    evidenceClass: spec.evidenceClass,
    calibrationMethod: spec.calibrationMethod,
    effectSupport: spec.effectSupport,
    practicalDelta: spec.practicalDecisionDelta,
    lowerQuantile: spec.lowerQuantile,
    upperQuantile: spec.upperQuantile,
    runBlockCount: spec.runBlockCount,
    minimumCorrectDirectionalPower: spec.minimumCorrectDirectionalPower,
    maximumWrongDirectionalProbability: spec.maximumWrongDirectionalProbability,
    processes: spec.alternativeProcesses,
  });
  if (
    !nullSpec ||
    !alternativeSpec ||
    new Set([
      ...nullSpec.processes.map((process) => process.id),
      ...alternativeSpec.processes.map((process) => process.id),
    ]).size !==
      nullSpec.processes.length + alternativeSpec.processes.length
  )
    return null;
  return spec as unknown as PercentileEstimandComparisonSpec;
}

/**
 * Compare a directional effect claim with a practical-exceedance claim while
 * holding the run count, interval rule, nulls, and alternatives fixed. The
 * exact trinomial oracle remains the decision authority for both estimands.
 */
export function comparePercentileEstimands(
  candidate: unknown,
): PercentileEstimandComparisonAnalysis {
  const spec = parsePercentileEstimandComparisonSpec(candidate);
  if (!spec) {
    return invalidPercentileEstimandComparisonAnalysis([
      "percentile estimand-comparison specification is invalid",
    ]);
  }
  const logFactorials = [0];
  for (let count = 1; count <= spec.runBlockCount; count += 1) {
    logFactorials[count] = logFactorials[count - 1]! + Math.log(count);
  }
  const allProcesses = [...spec.nullProcesses, ...spec.alternativeProcesses];
  const estimands = (
    [
      ["directional", spec.directionalDecisionDelta],
      ["practical-exceedance", spec.practicalDecisionDelta],
    ] as const
  ).map(([estimand, decisionDelta]) => {
    const rates = new Map(
      allProcesses.map((process) => [
        process.id,
        { positive: 0, negative: 0, negligible: 0, inconclusive: 0 },
      ]),
    );
    for (
      let negativeCount = 0;
      negativeCount <= spec.runBlockCount;
      negativeCount += 1
    ) {
      for (
        let zeroCount = 0;
        zeroCount <= spec.runBlockCount - negativeCount;
        zeroCount += 1
      ) {
        const positiveCount = spec.runBlockCount - negativeCount - zeroCount;
        const decision = exactTrinomialPercentileDecision(
          spec.runBlockCount,
          negativeCount,
          zeroCount,
          positiveCount,
          spec.lowerQuantile,
          spec.upperQuantile,
          decisionDelta,
        );
        for (const process of allProcesses) {
          rates.get(process.id)![decision] += exactMultinomialProbability(
            spec.runBlockCount,
            negativeCount,
            zeroCount,
            positiveCount,
            process.probabilities,
            logFactorials,
          );
        }
      }
    }
    return {
      estimand,
      decisionDelta,
      nullReport: spec.nullProcesses.map((process) => {
        const rate = rates.get(process.id)!;
        const falseDirectionalProbability = rate.positive + rate.negative;
        return {
          processId: process.id,
          falsePositiveDirectionProbability: rate.positive,
          falseNegativeDirectionProbability: rate.negative,
          falseDirectionalProbability,
          passesWrongDirectionTolerance:
            falseDirectionalProbability <=
            spec.maximumWrongDirectionalProbability,
        };
      }),
      alternativeReport: spec.alternativeProcesses.map((process) => {
        const rate = rates.get(process.id)!;
        const correctDirectionalProbability = rate[process.expectedDirection];
        const wrongDirectionalProbability =
          rate[
            process.expectedDirection === "positive" ? "negative" : "positive"
          ];
        return {
          processId: process.id,
          pairId: process.pairId,
          expectedDirection: process.expectedDirection,
          expectedEffect: process.probabilities[2] - process.probabilities[0],
          correctDirectionalProbability,
          wrongDirectionalProbability,
          negligibleProbability: rate.negligible,
          inconclusiveProbability: rate.inconclusive,
          passesPowerTarget:
            correctDirectionalProbability >=
            spec.minimumCorrectDirectionalPower,
          passesWrongDirectionTolerance:
            wrongDirectionalProbability <=
            spec.maximumWrongDirectionalProbability,
        };
      }),
    };
  });

  return {
    ok: true,
    comparisonSpecSha256: createHash("sha256")
      .update(JSON.stringify(spec))
      .digest("hex"),
    calibrationMethod: spec.calibrationMethod,
    monteCarloStandardError: 0,
    runBlockCount: spec.runBlockCount,
    estimands,
    scopeLimit:
      "Exact only for the two frozen estimands, symmetric trinomial nulls, mirror-paired alternatives, and one run count; the directional claim does not inherit the practical claim's null-risk result, and dependence, continuous effects, provider behavior, and real models remain uncalibrated.",
    errors: [],
  };
}

function invalidDirectionalQuantileCalibrationAnalysis(
  errors: string[],
): DirectionalQuantileCalibrationAnalysis {
  return {
    ok: false,
    calibrationSpecSha256: "",
    calibrationMethod: "",
    monteCarloStandardError: null,
    runBlockCount: 0,
    candidates: [],
    selectedLowerQuantile: null,
    selectedUpperQuantile: null,
    scopeLimit: "",
    errors,
  };
}

function parseDirectionalQuantileCalibrationSpec(
  candidate: unknown,
): DirectionalQuantileCalibrationSpec | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    return null;
  const spec = candidate as Record<string, unknown>;
  if (
    Object.keys(spec).sort().join(",") !==
      "calibrationMethod,candidateLowerQuantiles,directionalDecisionDelta,effectSupport,evidenceClass,maximumFalseDirectionalProbability,nullProcesses,runBlockCount,schema,selectionPolicy" ||
    spec.schema !==
      "scout.verification-allocation-directional-quantile-calibration/v1" ||
    spec.evidenceClass !== "synthetic-analysis-fixture" ||
    spec.calibrationMethod !== "exact-trinomial-enumeration" ||
    JSON.stringify(spec.effectSupport) !== "[-1,0,1]" ||
    spec.directionalDecisionDelta !== 0 ||
    spec.selectionPolicy !== "first-passing-all-nulls" ||
    !Number.isInteger(spec.runBlockCount) ||
    (spec.runBlockCount as number) < 2 ||
    (spec.runBlockCount as number) > 256 ||
    typeof spec.maximumFalseDirectionalProbability !== "number" ||
    !Number.isFinite(spec.maximumFalseDirectionalProbability) ||
    spec.maximumFalseDirectionalProbability <= 0 ||
    spec.maximumFalseDirectionalProbability >= 0.5 ||
    !Array.isArray(spec.candidateLowerQuantiles) ||
    spec.candidateLowerQuantiles.length === 0
  ) {
    return null;
  }
  const quantiles = spec.candidateLowerQuantiles as unknown[];
  if (
    quantiles.some(
      (quantile) =>
        typeof quantile !== "number" ||
        !Number.isFinite(quantile) ||
        quantile <= 0 ||
        quantile >= 0.5,
    ) ||
    new Set(quantiles).size !== quantiles.length ||
    quantiles.some(
      (quantile, index) =>
        index > 0 && (quantile as number) >= (quantiles[index - 1] as number),
    )
  ) {
    return null;
  }
  const nullSpec = parsePercentileNullCalibrationSpec({
    schema: "scout.verification-allocation-null-calibration/v1",
    evidenceClass: spec.evidenceClass,
    calibrationMethod: spec.calibrationMethod,
    effectSupport: spec.effectSupport,
    practicalDelta: Number.EPSILON,
    lowerQuantile: quantiles[0],
    upperQuantile: 1 - (quantiles[0] as number),
    falseDirectionalTolerance: spec.maximumFalseDirectionalProbability,
    candidateMinimumRunBlocks: spec.runBlockCount,
    verificationMaximumRunBlocks: spec.runBlockCount,
    reportRunBlockCounts: [spec.runBlockCount],
    processes: spec.nullProcesses,
  });
  return nullSpec
    ? (spec as unknown as DirectionalQuantileCalibrationSpec)
    : null;
}

function exactDirectionalRates(
  runBlockCount: number,
  lowerQuantile: number,
  processes: Array<{
    id: string;
    probabilities: [number, number, number];
  }>,
): Map<string, Record<PracticalEffectDecision, number>> {
  const rates = new Map(
    processes.map((process) => [
      process.id,
      { positive: 0, negative: 0, negligible: 0, inconclusive: 0 },
    ]),
  );
  const logFactorials = [0];
  for (let count = 1; count <= runBlockCount; count += 1) {
    logFactorials[count] = logFactorials[count - 1]! + Math.log(count);
  }
  for (
    let negativeCount = 0;
    negativeCount <= runBlockCount;
    negativeCount += 1
  ) {
    for (
      let zeroCount = 0;
      zeroCount <= runBlockCount - negativeCount;
      zeroCount += 1
    ) {
      const positiveCount = runBlockCount - negativeCount - zeroCount;
      const decision = exactTrinomialPercentileDecision(
        runBlockCount,
        negativeCount,
        zeroCount,
        positiveCount,
        lowerQuantile,
        1 - lowerQuantile,
        0,
      );
      for (const process of processes) {
        rates.get(process.id)![decision] += exactMultinomialProbability(
          runBlockCount,
          negativeCount,
          zeroCount,
          positiveCount,
          process.probabilities,
          logFactorials,
        );
      }
    }
  }
  return rates;
}

/** Select a directional interval using null processes only. */
export function calibrateDirectionalQuantiles(
  candidate: unknown,
): DirectionalQuantileCalibrationAnalysis {
  const spec = parseDirectionalQuantileCalibrationSpec(candidate);
  if (!spec) {
    return invalidDirectionalQuantileCalibrationAnalysis([
      "directional quantile calibration specification is invalid",
    ]);
  }
  const candidates = spec.candidateLowerQuantiles.map((lowerQuantile) => {
    const rates = exactDirectionalRates(
      spec.runBlockCount,
      lowerQuantile,
      spec.nullProcesses,
    );
    const nullReport = spec.nullProcesses.map((process) => {
      const rate = rates.get(process.id)!;
      const falseDirectionalProbability = rate.positive + rate.negative;
      return {
        processId: process.id,
        falsePositiveDirectionProbability: rate.positive,
        falseNegativeDirectionProbability: rate.negative,
        falseDirectionalProbability,
        passesWrongDirectionTolerance:
          falseDirectionalProbability <=
          spec.maximumFalseDirectionalProbability,
      };
    });
    return {
      lowerQuantile,
      upperQuantile: 1 - lowerQuantile,
      nullReport,
      passesAllNulls: nullReport.every(
        (entry) => entry.passesWrongDirectionTolerance,
      ),
    };
  });
  const selected = candidates.find((entry) => entry.passesAllNulls) ?? null;
  return {
    ok: selected !== null,
    calibrationSpecSha256: createHash("sha256")
      .update(JSON.stringify(spec))
      .digest("hex"),
    calibrationMethod: spec.calibrationMethod,
    monteCarloStandardError: 0,
    runBlockCount: spec.runBlockCount,
    candidates,
    selectedLowerQuantile: selected?.lowerQuantile ?? null,
    selectedUpperQuantile: selected?.upperQuantile ?? null,
    scopeLimit:
      "Exact only for the frozen candidate grid, three symmetric trinomial nulls, and 105 run blocks; selection uses no alternative outcomes, and continuous effects, other grids, dependence, finite resampling, provider behavior, and real models remain uncalibrated.",
    errors: selected ? [] : ["no candidate interval passes every null process"],
  };
}

function invalidDirectionalQuantilePowerAnalysis(
  errors: string[],
): DirectionalQuantilePowerAnalysis {
  return {
    ok: false,
    powerSpecSha256: "",
    calibrationSpecSha256: "",
    calibrationMethod: "",
    monteCarloStandardError: null,
    runBlockCount: 0,
    selectedLowerQuantile: null,
    selectedUpperQuantile: null,
    report: [],
    scopeLimit: "",
    errors,
  };
}

/** Measure power only after reproducing and binding the null-only selection. */
export function measureCalibratedDirectionalPower(
  calibrationCandidate: unknown,
  powerCandidate: unknown,
): DirectionalQuantilePowerAnalysis {
  const calibration = calibrateDirectionalQuantiles(calibrationCandidate);
  if (!calibration.ok) {
    return invalidDirectionalQuantilePowerAnalysis([
      "directional null calibration is not valid",
    ]);
  }
  if (
    !powerCandidate ||
    typeof powerCandidate !== "object" ||
    Array.isArray(powerCandidate)
  ) {
    return invalidDirectionalQuantilePowerAnalysis([
      "directional quantile power specification is invalid",
    ]);
  }
  const power = powerCandidate as Record<string, unknown>;
  const alternativeSpec = parsePercentileAlternativeCalibrationSpec({
    schema: "scout.verification-allocation-alternative-calibration/v1",
    evidenceClass: power.evidenceClass,
    calibrationMethod: power.calibrationMethod,
    effectSupport: power.effectSupport,
    practicalDelta: Number.EPSILON,
    lowerQuantile: power.selectedLowerQuantile,
    upperQuantile: power.selectedUpperQuantile,
    runBlockCount: power.runBlockCount,
    minimumCorrectDirectionalPower: power.minimumCorrectDirectionalPower,
    maximumWrongDirectionalProbability:
      power.maximumWrongDirectionalProbability,
    processes: power.alternativeProcesses,
  });
  const calibrationSpec =
    calibrationCandidate as DirectionalQuantileCalibrationSpec;
  if (
    Object.keys(power).sort().join(",") !==
      "alternativeProcesses,calibrationMethod,calibrationSpecSha256,directionalDecisionDelta,effectSupport,evidenceClass,maximumWrongDirectionalProbability,minimumCorrectDirectionalPower,runBlockCount,schema,selectedLowerQuantile,selectedUpperQuantile" ||
    power.schema !==
      "scout.verification-allocation-directional-quantile-power/v1" ||
    power.directionalDecisionDelta !== 0 ||
    power.calibrationSpecSha256 !== calibration.calibrationSpecSha256 ||
    power.runBlockCount !== calibration.runBlockCount ||
    power.selectedLowerQuantile !== calibration.selectedLowerQuantile ||
    power.selectedUpperQuantile !== calibration.selectedUpperQuantile ||
    !alternativeSpec ||
    alternativeSpec.processes.some((process) =>
      calibrationSpec.nullProcesses.some(
        (nullProcess) => nullProcess.id === process.id,
      ),
    )
  ) {
    return invalidDirectionalQuantilePowerAnalysis([
      "directional quantile power specification is invalid or not bound to the selected null calibration",
    ]);
  }
  const rates = exactDirectionalRates(
    alternativeSpec.runBlockCount,
    alternativeSpec.lowerQuantile,
    alternativeSpec.processes,
  );
  const report = alternativeSpec.processes.map((process) => {
    const rate = rates.get(process.id)!;
    const correctDirectionalProbability = rate[process.expectedDirection];
    const wrongDirectionalProbability =
      rate[process.expectedDirection === "positive" ? "negative" : "positive"];
    return {
      processId: process.id,
      pairId: process.pairId,
      expectedDirection: process.expectedDirection,
      expectedEffect: process.probabilities[2] - process.probabilities[0],
      correctDirectionalProbability,
      wrongDirectionalProbability,
      negligibleProbability: rate.negligible,
      inconclusiveProbability: rate.inconclusive,
      passesPowerTarget:
        correctDirectionalProbability >=
        alternativeSpec.minimumCorrectDirectionalPower,
      passesWrongDirectionTolerance:
        wrongDirectionalProbability <=
        alternativeSpec.maximumWrongDirectionalProbability,
    };
  });
  return {
    ok: true,
    powerSpecSha256: createHash("sha256")
      .update(JSON.stringify(powerCandidate))
      .digest("hex"),
    calibrationSpecSha256: calibration.calibrationSpecSha256,
    calibrationMethod: alternativeSpec.calibrationMethod,
    monteCarloStandardError: 0,
    runBlockCount: alternativeSpec.runBlockCount,
    selectedLowerQuantile: alternativeSpec.lowerQuantile,
    selectedUpperQuantile: alternativeSpec.upperQuantile,
    report,
    scopeLimit:
      "Exact only for the null-selected interval, frozen mirror-paired trinomial alternatives, and 105 run blocks; the candidate grid and synthetic effects may not transfer to continuous effects, dependence, provider behavior, or real models.",
    errors: [],
  };
}

function invalidFinitePercentileComparisonAnalysis(
  errors: string[],
): FinitePercentileComparisonAnalysis {
  return {
    ok: false,
    decisionAuthority: "",
    finiteDecisionRole: "",
    comparisonSpecSha256: "",
    calibrationSpecSha256: "",
    bootstrapSpecSha256: "",
    modelId: "",
    runBlockCount: 0,
    compositionCount: 0,
    decisionMismatchCount: 0,
    mismatchExamples: [],
    processes: [],
    scopeLimit: "",
    errors,
  };
}

/**
 * Compare the canonical finite deterministic resampler with the exact
 * conditional percentile oracle for every -1/0/+1 composition at the frozen
 * candidate run count. Null-process probabilities are integrated exactly;
 * the result remains conditional on the declared resampling seed and model ID.
 */
export function compareFinitePercentileNullProcesses(
  calibrationCandidate: unknown,
  bootstrapCandidate: unknown,
  modelIdCandidate: unknown,
): FinitePercentileComparisonAnalysis {
  const calibrationSpec =
    parsePercentileNullCalibrationSpec(calibrationCandidate);
  const bootstrapSpec = parseModelRunBlockBootstrapSpec(bootstrapCandidate);
  if (
    !calibrationSpec ||
    !bootstrapSpec ||
    typeof modelIdCandidate !== "string" ||
    !/^[a-z][a-z0-9-]*$/.test(modelIdCandidate)
  ) {
    return invalidFinitePercentileComparisonAnalysis([
      "finite percentile comparison specification is invalid",
    ]);
  }
  const modelId = modelIdCandidate;
  const runBlockCount = calibrationSpec.candidateMinimumRunBlocks;
  const calibrationSpecSha256 = createHash("sha256")
    .update(JSON.stringify(calibrationSpec))
    .digest("hex");
  const bootstrapSpecSha256 = createHash("sha256")
    .update(JSON.stringify(bootstrapSpec))
    .digest("hex");
  const comparisonSpecSha256 = createHash("sha256")
    .update(
      JSON.stringify({
        schema: "scout.verification-allocation-finite-comparison/v1",
        evidenceClass: "synthetic-analysis-fixture",
        calibrationSpecSha256,
        bootstrapSpecSha256,
        modelId,
        runBlockCount,
        compositionEnumeration: "complete",
      }),
    )
    .digest("hex");

  const sampledPrefixes = Array.from(
    { length: bootstrapSpec.resamples },
    (_, replicate) => {
      const indexCounts = new Uint16Array(runBlockCount);
      for (let draw = 0; draw < runBlockCount; draw += 1) {
        const blockIndex = deterministicBlockIndex(
          bootstrapSpec.resamplingSeedSha256,
          replicate,
          modelId,
          draw,
          runBlockCount,
        );
        indexCounts[blockIndex]! += 1;
      }
      const prefix = new Uint16Array(runBlockCount + 1);
      for (let index = 0; index < runBlockCount; index += 1) {
        prefix[index + 1] = prefix[index]! + indexCounts[index]!;
      }
      return prefix;
    },
  );
  const logFactorials = [0];
  for (let count = 1; count <= runBlockCount; count += 1) {
    logFactorials[count] = logFactorials[count - 1]! + Math.log(count);
  }
  const processRates = new Map(
    calibrationSpec.processes.map((process) => [
      process.id,
      {
        exactFalseDirectionalProbability: 0,
        finiteFalseDirectionalProbability: 0,
        decisionMismatchProbability: 0,
        finiteDirectionalExactNonDirectionalProbability: 0,
        exactDirectionalFiniteNonDirectionalProbability: 0,
        remainingDecisionMismatchProbability: 0,
      },
    ]),
  );
  const mismatchExamples: FinitePercentileComparisonAnalysis["mismatchExamples"] =
    [];
  let compositionCount = 0;
  let decisionMismatchCount = 0;

  for (
    let negativeCount = 0;
    negativeCount <= runBlockCount;
    negativeCount += 1
  ) {
    for (
      let zeroCount = 0;
      zeroCount <= runBlockCount - negativeCount;
      zeroCount += 1
    ) {
      const positiveCount = runBlockCount - negativeCount - zeroCount;
      compositionCount += 1;
      const exactDecision = exactTrinomialPercentileDecision(
        runBlockCount,
        negativeCount,
        zeroCount,
        positiveCount,
        calibrationSpec.lowerQuantile,
        calibrationSpec.upperQuantile,
        calibrationSpec.practicalDelta,
      );
      const finiteReplicates = sampledPrefixes.map((prefix) => {
        const negativeDraws = prefix[negativeCount]!;
        const nonPositiveDraws = prefix[negativeCount + zeroCount]!;
        return (
          (runBlockCount - nonPositiveDraws - negativeDraws) / runBlockCount
        );
      });
      const finiteDecision = classifyPracticalInterval(
        empiricalQuantile(finiteReplicates, bootstrapSpec.lowerQuantile),
        empiricalQuantile(finiteReplicates, bootstrapSpec.upperQuantile),
        calibrationSpec.practicalDelta,
      );
      const mismatch = finiteDecision !== exactDecision;
      const exactDirectional =
        exactDecision === "positive" || exactDecision === "negative";
      const finiteDirectional =
        finiteDecision === "positive" || finiteDecision === "negative";
      if (mismatch) {
        decisionMismatchCount += 1;
        if (mismatchExamples.length < 12) {
          mismatchExamples.push({
            negativeCount,
            zeroCount,
            positiveCount,
            exactDecision,
            finiteDecision,
          });
        }
      }

      for (const process of calibrationSpec.processes) {
        const probability = exactMultinomialProbability(
          runBlockCount,
          negativeCount,
          zeroCount,
          positiveCount,
          process.probabilities,
          logFactorials,
        );
        const rates = processRates.get(process.id)!;
        if (exactDirectional) {
          rates.exactFalseDirectionalProbability += probability;
        }
        if (finiteDirectional) {
          rates.finiteFalseDirectionalProbability += probability;
        }
        if (mismatch) {
          rates.decisionMismatchProbability += probability;
          if (finiteDirectional && !exactDirectional) {
            rates.finiteDirectionalExactNonDirectionalProbability +=
              probability;
          } else if (exactDirectional && !finiteDirectional) {
            rates.exactDirectionalFiniteNonDirectionalProbability +=
              probability;
          } else {
            rates.remainingDecisionMismatchProbability += probability;
          }
        }
      }
    }
  }

  return {
    ok: true,
    decisionAuthority: "exact-trinomial-oracle",
    finiteDecisionRole: "diagnostic-comparison-only",
    comparisonSpecSha256,
    calibrationSpecSha256,
    bootstrapSpecSha256,
    modelId,
    runBlockCount,
    compositionCount,
    decisionMismatchCount,
    mismatchExamples,
    processes: calibrationSpec.processes.map((process) => {
      const rates = processRates.get(process.id)!;
      return {
        processId: process.id,
        ...rates,
        authoritativeFalseDirectionalProbability:
          rates.exactFalseDirectionalProbability,
        passesAuthoritativeTolerance:
          rates.exactFalseDirectionalProbability <=
          calibrationSpec.falseDirectionalTolerance,
      };
    }),
    scopeLimit:
      "The exact oracle is the calibration decision authority; finite results are diagnostic only. Exact only for the frozen 64-block -1/0/+1 composition space, null processes, resampling seed, and model ID; other run counts, identifiers, effects, dependence, alternatives, and real models remain uncalibrated.",
    errors: [],
  };
}

if (import.meta.main) {
  const result = verifyFactorialSchedule(buildToyFactorialSchedule());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}
