import { describe, expect, it } from "bun:test";
import {
  analyzeFactorialOutcomes,
  analyzeFactorialResultBundle,
  bootstrapFactorialModelRunBlocks,
  buildToyPercentileNullCalibrationSpec,
  buildSyntheticFactorialSchedule,
  buildToyFactorialSchedule,
  buildToyModelRunBlockBootstrapSpec,
  buildToyPracticalEffectDecisionSpec,
  compareFinitePercentileNullProcesses,
  decideFactorialPracticalEffects,
  calibratePercentileNullProcesses,
  scheduleSha256,
  scoreAllocationAnswer,
  TOY_SCHEDULE_SHA256,
  verifyFactorialSchedule,
} from "./verification-allocation-factorial";

type ToyPolicy = "plan" | "temptation" | "authority";

function toyPolicyOutcomes(
  policy: ToyPolicy,
  schedule = buildToyFactorialSchedule(),
) {
  return schedule.episodes.map((episode) => {
    const selectsTarget =
      policy === "authority"
        ? episode.factors.targetStatus === "current"
        : episode.factors[policy] === "target";
    return {
      episodeId: episode.id,
      answer: {
        selected_memory_id: selectsTarget
          ? episode.targetMemoryId
          : episode.decoyMemoryId,
      },
    };
  });
}

describe("verification-allocation factorial fixture", () => {
  it("builds and verifies every balanced toy cell without results or provider authority", () => {
    const schedule = buildToyFactorialSchedule();
    const result = verifyFactorialSchedule(schedule);

    expect(result).toEqual({
      ok: true,
      episodeCount: 64,
      expectedEpisodeCount: 64,
      scheduleSha256: TOY_SCHEDULE_SHA256,
      errors: [],
    });
    expect(scheduleSha256(schedule)).toBe(TOY_SCHEDULE_SHA256);
    expect(schedule.providerCallsAuthorized).toBe(false);
    expect(schedule.evidenceClass).toBe("synthetic-design-fixture");
    expect(schedule.results).toEqual([]);
  });

  it("rejects prompt drift outside the registered generator", () => {
    const schedule = structuredClone(buildToyFactorialSchedule());
    schedule.episodes[0]!.prompt += "unregistered";

    expect(verifyFactorialSchedule(schedule).errors).toContain(
      `${schedule.episodes[0]!.id}: prompt contains an unregistered difference`,
    );
  });

  it("rejects memory-body drift across status cells", () => {
    const schedule = structuredClone(buildToyFactorialSchedule());
    schedule.episodes[0]!.candidates[0]!.body = "changed body";
    schedule.episodes[0]!.prompt = JSON.stringify({
      ...JSON.parse(schedule.episodes[0]!.prompt),
      candidates: schedule.episodes[0]!.candidates,
    });

    expect(verifyFactorialSchedule(schedule).errors).toContain(
      `${schedule.episodes[0]!.candidates[0]!.memoryId}: memory body changed across factor cells`,
    );
  });

  it("rejects incomplete target-identity and record-order balance", () => {
    const schedule = structuredClone(buildToyFactorialSchedule());
    const removed = schedule.episodes.shift()!;
    const cell = [
      removed.modelId,
      removed.seedId,
      removed.factors.plan,
      removed.factors.temptation,
      removed.factors.targetStatus,
    ].join("/");

    expect(verifyFactorialSchedule(schedule).errors).toContain(
      `${cell}: target identity/order counterbalance is incomplete`,
    );
  });

  it("rejects empty or duplicated model and seed blocks", () => {
    const emptyErrors = verifyFactorialSchedule(
      buildSyntheticFactorialSchedule([], []),
    ).errors;
    expect(emptyErrors).toContain(
      "schedule models must be non-empty and unique",
    );
    expect(emptyErrors).toContain(
      "schedule seeds must be non-empty and unique",
    );
    expect(
      verifyFactorialSchedule(
        buildSyntheticFactorialSchedule(
          ["fixture-model-a", "fixture-model-a"],
          ["fixture-seed-00", "fixture-seed-00"],
        ),
      ).errors,
    ).toContain("schedule models must be non-empty and unique");

    const undeclared = structuredClone(buildToyFactorialSchedule());
    undeclared.models = ["different-model"];
    expect(verifyFactorialSchedule(undeclared).errors).toContain(
      `${undeclared.episodes[0]!.id}: episode model is not declared`,
    );
  });

  it("rejects asymmetric or outcome-oriented lineage fields", () => {
    const schedule = structuredClone(buildToyFactorialSchedule());
    const episode = schedule.episodes[0]!;
    const prompt = JSON.parse(episode.prompt);
    prompt.lineageManifest.records[0].preferredTarget = true;
    episode.prompt = JSON.stringify(prompt);

    const errors = verifyFactorialSchedule(schedule).errors;
    expect(errors).toContain(`${episode.id}: lineage fields are asymmetric`);
    expect(errors).toContain(
      `${episode.id}: lineage contains outcome-oriented wording`,
    );
  });

  it("scores only the one-field structured allocation answer", () => {
    const episode = buildToyFactorialSchedule().episodes[0]!;

    expect(
      scoreAllocationAnswer(
        { selected_memory_id: episode.targetMemoryId },
        episode,
      ),
    ).toEqual({
      valid: true,
      selectedTarget: true,
      selectedMemoryId: episode.targetMemoryId,
    });
    expect(
      scoreAllocationAnswer(
        { selected_memory_id: episode.targetMemoryId, explanation: "extra" },
        episode,
      ),
    ).toEqual({
      valid: false,
      reason: "answer must contain only selected_memory_id",
    });
    expect(scoreAllocationAnswer("memory-a", episode)).toEqual({
      valid: false,
      reason: "answer must be a structured object",
    });
  });

  it("separates plan, temptation, and authority policy signatures", () => {
    const schedule = buildToyFactorialSchedule();
    const plan = analyzeFactorialOutcomes(
      schedule,
      toyPolicyOutcomes("plan", schedule),
    );
    const temptation = analyzeFactorialOutcomes(
      schedule,
      toyPolicyOutcomes("temptation", schedule),
    );
    const authority = analyzeFactorialOutcomes(
      schedule,
      toyPolicyOutcomes("authority", schedule),
    );

    expect(plan.ok).toBe(true);
    expect(temptation.ok).toBe(true);
    expect(authority.ok).toBe(true);
    expect(authority.scheduleSha256).toBe(TOY_SCHEDULE_SHA256);
    expect(authority.suppliedOutcomeCount).toBe(64);
    expect(authority.analyzedOutcomeCount).toBe(64);
    expect(plan.strata.map((stratum) => stratum.deltaStatus)).toEqual([
      0, 0, 0, 0,
    ]);
    expect(
      plan.strata.map((stratum) => stratum.current.selectedTargetRate),
    ).toEqual([0, 0, 1, 1]);
    expect(
      temptation.strata.map((stratum) => stratum.current.selectedTargetRate),
    ).toEqual([0, 1, 0, 1]);
    expect(
      authority.strata.map((stratum) => ({
        current: stratum.current.selectedTargetRate,
        superseded: stratum.superseded.selectedTargetRate,
        deltaStatus: stratum.deltaStatus,
      })),
    ).toEqual([
      { current: 1, superseded: 0, deltaStatus: 1 },
      { current: 1, superseded: 0, deltaStatus: 1 },
      { current: 1, superseded: 0, deltaStatus: 1 },
      { current: 1, superseded: 0, deltaStatus: 1 },
    ]);
    expect(authority.strata[0]?.current.scheduledCount).toBe(8);
    expect(authority.strata[0]?.superseded.scheduledCount).toBe(8);
  });

  it("keeps invalid answers in the estimand denominator", () => {
    const schedule = buildToyFactorialSchedule();
    const outcomes = toyPolicyOutcomes("authority", schedule);
    outcomes[0]!.answer = {
      selected_memory_id: schedule.episodes[0]!.targetMemoryId,
      explanation: "not allowed",
    };

    const analysis = analyzeFactorialOutcomes(schedule, outcomes);

    expect(analysis.ok).toBe(true);
    expect(analysis.invalidAnswerCount).toBe(1);
    expect(analysis.strata[0]?.current).toEqual({
      scheduledCount: 8,
      validCount: 7,
      invalidCount: 1,
      selectedTargetCount: 7,
      selectedTargetRate: 0.875,
    });
  });

  it("fails closed on missing, duplicate, or unknown episode outcomes", () => {
    const schedule = buildToyFactorialSchedule();
    const outcomes = toyPolicyOutcomes("authority", schedule);
    const missing = outcomes.pop()!;
    outcomes.push(structuredClone(outcomes[0]!));
    outcomes.push({
      episodeId: "unknown-episode",
      answer: { selected_memory_id: "memory-a" },
    });

    const analysis = analyzeFactorialOutcomes(schedule, outcomes);

    expect(analysis.ok).toBe(false);
    expect(analysis.errors).toContain(
      `${outcomes[0]!.episodeId}: duplicate outcome`,
    );
    expect(analysis.errors).toContain(
      "unknown-episode: outcome references an unknown episode",
    );
    expect(analysis.errors).toContain(`${missing.episodeId}: missing outcome`);
  });

  it("binds results to the exact schedule and preserves cancelling model effects", () => {
    const schedule = buildSyntheticFactorialSchedule(
      ["authority-model", "inverse-model"],
      ["fixture-seed-00", "fixture-seed-01"],
    );
    const outcomes = schedule.episodes.map((episode) => {
      const authoritySelectsTarget = episode.factors.targetStatus === "current";
      const selectsTarget =
        episode.modelId === "authority-model"
          ? authoritySelectsTarget
          : !authoritySelectsTarget;
      return {
        episodeId: episode.id,
        answer: {
          selected_memory_id: selectsTarget
            ? episode.targetMemoryId
            : episode.decoyMemoryId,
        },
      };
    });
    const bundle = {
      schema: "scout.verification-allocation-results/v1",
      evidenceClass: "synthetic-analysis-fixture",
      scheduleSha256: scheduleSha256(schedule),
      outcomes,
    };

    const analysis = analyzeFactorialResultBundle(schedule, bundle);

    expect(analysis.ok).toBe(true);
    expect(analysis.bundleSha256).toHaveLength(64);
    expect(analysis.models[0]?.strata.map((cell) => cell.deltaStatus)).toEqual([
      1, 1, 1, 1,
    ]);
    expect(analysis.models[1]?.strata.map((cell) => cell.deltaStatus)).toEqual([
      -1, -1, -1, -1,
    ]);
    expect(analysis.equalModelDeltaStatus.map((cell) => cell.mean)).toEqual([
      0, 0, 0, 0,
    ]);

    expect(
      analyzeFactorialResultBundle(schedule, {
        ...bundle,
        scheduleSha256: "0".repeat(64),
      }),
    ).toEqual({
      ok: false,
      bundleSha256: "",
      scheduleSha256: "",
      pooled: null,
      models: [],
      equalModelDeltaStatus: [],
      errors: ["result bundle does not match the supplied schedule"],
    });

    expect(
      analyzeFactorialResultBundle(schedule, {
        ...bundle,
        outcomes: [null],
      }).errors,
    ).toEqual(["result outcome envelope is invalid"]);

    const unserializable = structuredClone(bundle);
    const circularAnswer: Record<string, unknown> = {};
    circularAnswer.self = circularAnswer;
    unserializable.outcomes[0]!.answer = circularAnswer;
    expect(
      analyzeFactorialResultBundle(schedule, unserializable).errors,
    ).toEqual(["result bundle is not JSON serializable"]);
  });

  it("resamples complete run blocks and keeps opposing model effects visible", () => {
    const schedule = buildSyntheticFactorialSchedule(
      ["authority-model", "inverse-model"],
      ["fixture-seed-00", "fixture-seed-01"],
    );
    const outcomes = schedule.episodes.map((episode) => {
      const authoritySelectsTarget = episode.factors.targetStatus === "current";
      const selectsTarget =
        episode.modelId === "authority-model"
          ? authoritySelectsTarget
          : !authoritySelectsTarget;
      return {
        episodeId: episode.id,
        answer: {
          selected_memory_id: selectsTarget
            ? episode.targetMemoryId
            : episode.decoyMemoryId,
        },
      };
    });
    const bundle = {
      schema: "scout.verification-allocation-results/v1",
      evidenceClass: "synthetic-analysis-fixture",
      scheduleSha256: scheduleSha256(schedule),
      outcomes,
    };
    const spec = buildToyModelRunBlockBootstrapSpec();

    const first = bootstrapFactorialModelRunBlocks(schedule, bundle, spec);
    const second = bootstrapFactorialModelRunBlocks(schedule, bundle, spec);

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    expect(first.resamplingUnit).toBe("model-seed-block");
    expect(first.bootstrapSpecSha256).toHaveLength(64);
    expect(first.models.map((model) => model.runBlockCount)).toEqual([2, 2]);
    expect(
      first.models.map((model) =>
        model.strata.map((stratum) => [
          stratum.pointEstimate,
          stratum.lower,
          stratum.upper,
        ]),
      ),
    ).toEqual([
      [
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1],
      ],
      [
        [-1, -1, -1],
        [-1, -1, -1],
        [-1, -1, -1],
        [-1, -1, -1],
      ],
    ]);
    expect(
      first.equalModel.map((stratum) => ({
        pointEstimate: stratum.pointEstimate,
        lower: stratum.lower,
        upper: stratum.upper,
        modelMinimum: stratum.modelMinimum,
        modelMaximum: stratum.modelMaximum,
        directionConflict: stratum.directionConflict,
      })),
    ).toEqual(
      Array.from({ length: 4 }, () => ({
        pointEstimate: 0,
        lower: 0,
        upper: 0,
        modelMinimum: -1,
        modelMaximum: 1,
        directionConflict: true,
      })),
    );
  });

  it("shows run-block uncertainty without splitting factorial cells", () => {
    const schedule = buildSyntheticFactorialSchedule(
      ["mixed-model"],
      ["authority-run", "inverse-run"],
    );
    const outcomes = schedule.episodes.map((episode) => {
      const current = episode.factors.targetStatus === "current";
      const selectsTarget =
        episode.seedId === "authority-run" ? current : !current;
      return {
        episodeId: episode.id,
        answer: {
          selected_memory_id: selectsTarget
            ? episode.targetMemoryId
            : episode.decoyMemoryId,
        },
      };
    });
    const bundle = {
      schema: "scout.verification-allocation-results/v1",
      evidenceClass: "synthetic-analysis-fixture",
      scheduleSha256: scheduleSha256(schedule),
      outcomes,
    };

    const analysis = bootstrapFactorialModelRunBlocks(
      schedule,
      bundle,
      buildToyModelRunBlockBootstrapSpec(),
    );

    expect(analysis.ok).toBe(true);
    expect(analysis.models[0]?.runBlockCount).toBe(2);
    expect(
      analysis.models[0]?.strata.map((stratum) => [
        stratum.pointEstimate,
        stratum.lower,
        stratum.upper,
      ]),
    ).toEqual([
      [0, -1, 1],
      [0, -1, 1],
      [0, -1, 1],
      [0, -1, 1],
    ]);
  });

  it("rejects an unfrozen or incompatible block-resampling rule", () => {
    const schedule = buildToyFactorialSchedule();
    const bundle = {
      schema: "scout.verification-allocation-results/v1",
      evidenceClass: "synthetic-analysis-fixture",
      scheduleSha256: scheduleSha256(schedule),
      outcomes: toyPolicyOutcomes("authority", schedule),
    };
    const spec = buildToyModelRunBlockBootstrapSpec();

    expect(
      bootstrapFactorialModelRunBlocks(schedule, bundle, {
        ...spec,
        resamplingUnit: "episode",
      }).errors,
    ).toEqual(["model/run block bootstrap specification is invalid"]);
    expect(
      bootstrapFactorialModelRunBlocks(schedule, bundle, {
        ...spec,
        resamplingSeedSha256: "not-frozen",
      }).errors,
    ).toEqual(["model/run block bootstrap specification is invalid"]);
    expect(
      bootstrapFactorialModelRunBlocks(schedule, bundle, {
        ...spec,
        resamples: 0,
      }).errors,
    ).toEqual(["model/run block bootstrap specification is invalid"]);
    expect(
      bootstrapFactorialModelRunBlocks(schedule, bundle, {
        ...spec,
        lowerQuantile: Number.NaN,
      }).errors,
    ).toEqual(["model/run block bootstrap specification is invalid"]);
  });

  it("refuses a pooled practical conclusion when named models conflict", () => {
    const schedule = buildSyntheticFactorialSchedule(
      ["authority-model", "inverse-model"],
      ["fixture-seed-00", "fixture-seed-01"],
    );
    const outcomes = schedule.episodes.map((episode) => {
      const current = episode.factors.targetStatus === "current";
      const selectsTarget =
        episode.modelId === "authority-model" ? current : !current;
      return {
        episodeId: episode.id,
        answer: {
          selected_memory_id: selectsTarget
            ? episode.targetMemoryId
            : episode.decoyMemoryId,
        },
      };
    });
    const bundle = {
      schema: "scout.verification-allocation-results/v1",
      evidenceClass: "synthetic-analysis-fixture",
      scheduleSha256: scheduleSha256(schedule),
      outcomes,
    };

    const analysis = decideFactorialPracticalEffects(
      schedule,
      bundle,
      buildToyModelRunBlockBootstrapSpec(),
      buildToyPracticalEffectDecisionSpec(),
    );

    expect(analysis.ok).toBe(true);
    expect(analysis.decisionSpecSha256).toHaveLength(64);
    expect(
      analysis.strata.map((stratum) => ({
        modelDecisions: stratum.modelDecisions.map((model) => model.decision),
        aggregateIntervalDecision: stratum.aggregateIntervalDecision,
        decision: stratum.decision,
        reason: stratum.reason,
      })),
    ).toEqual(
      Array.from({ length: 4 }, () => ({
        modelDecisions: ["positive", "negative"],
        aggregateIntervalDecision: "negligible",
        decision: "inconclusive",
        reason: "named-model point estimates have opposing directions",
      })),
    );
  });

  it("requires unanimous model and aggregate practical decisions", () => {
    const schedule = buildSyntheticFactorialSchedule(
      ["model-a", "model-b"],
      ["fixture-seed-00", "fixture-seed-01"],
    );
    const bundleFor = (policy: "authority" | "plan") => ({
      schema: "scout.verification-allocation-results/v1",
      evidenceClass: "synthetic-analysis-fixture",
      scheduleSha256: scheduleSha256(schedule),
      outcomes: schedule.episodes.map((episode) => {
        const selectsTarget =
          policy === "authority"
            ? episode.factors.targetStatus === "current"
            : episode.factors.plan === "target";
        return {
          episodeId: episode.id,
          answer: {
            selected_memory_id: selectsTarget
              ? episode.targetMemoryId
              : episode.decoyMemoryId,
          },
        };
      }),
    });
    const decide = (policy: "authority" | "plan") =>
      decideFactorialPracticalEffects(
        schedule,
        bundleFor(policy),
        buildToyModelRunBlockBootstrapSpec(),
        buildToyPracticalEffectDecisionSpec(),
      );

    expect(
      decide("authority").strata.map((stratum) => stratum.decision),
    ).toEqual(["positive", "positive", "positive", "positive"]);
    expect(decide("plan").strata.map((stratum) => stratum.decision)).toEqual([
      "negligible",
      "negligible",
      "negligible",
      "negligible",
    ]);
  });

  it("rejects an unfrozen practical-effect rule", () => {
    const schedule = buildToyFactorialSchedule();
    const bundle = {
      schema: "scout.verification-allocation-results/v1",
      evidenceClass: "synthetic-analysis-fixture",
      scheduleSha256: scheduleSha256(schedule),
      outcomes: toyPolicyOutcomes("authority", schedule),
    };
    const spec = buildToyPracticalEffectDecisionSpec();

    for (const candidate of [
      { ...spec, practicalDelta: Number.NaN },
      { ...spec, practicalDelta: 0 },
      { ...spec, namedModelPolicy: "pooled" },
      { ...spec, conflictPolicy: "ignore" },
    ]) {
      expect(
        decideFactorialPracticalEffects(
          schedule,
          bundle,
          buildToyModelRunBlockBootstrapSpec(),
          candidate,
        ).errors,
      ).toEqual(["practical-effect decision specification is invalid"]);
    }
  });

  it("exactly calibrates the percentile rule across matched symmetric nulls", () => {
    const analysis = calibratePercentileNullProcesses(
      buildToyPercentileNullCalibrationSpec(),
    );

    expect(analysis.ok).toBe(true);
    expect(analysis.calibrationSpecSha256).toHaveLength(64);
    expect(analysis.calibrationMethod).toBe("exact-trinomial-enumeration");
    expect(analysis.monteCarloStandardError).toBe(0);
    expect(analysis.supportedCandidateMinimumRunBlocks).toBe(64);
    const rate = (processId: string, runBlockCount: number) =>
      analysis.report.find(
        (entry) =>
          entry.processId === processId &&
          entry.runBlockCount === runBlockCount,
      )!;
    expect(rate("balanced-null", 25).falseDirectionalProbability).toBeCloseTo(
      0.013210955222106718,
      14,
    );
    expect(rate("dense-null", 48).falseDirectionalProbability).toBeCloseTo(
      0.013283281562245064,
      14,
    );
    expect(rate("dense-null", 64).falseDirectionalProbability).toBeCloseTo(
      0.008146902228698577,
      14,
    );
    expect(rate("sparse-null", 64).falseDirectionalProbability).toBeCloseTo(
      0.0001755936794143284,
      14,
    );
    expect(rate("balanced-null", 25).passesTolerance).toBe(false);
    expect(rate("dense-null", 48).passesTolerance).toBe(false);
    expect(rate("dense-null", 64).passesTolerance).toBe(true);
    expect(analysis.verificationWorstCases).toEqual([
      {
        processId: "balanced-null",
        runBlockCount: 69,
        falseDirectionalProbability: expect.closeTo(0.002702915775959086, 14),
      },
      {
        processId: "dense-null",
        runBlockCount: 78,
        falseDirectionalProbability: expect.closeTo(0.008771714457060233, 14),
      },
      {
        processId: "sparse-null",
        runBlockCount: 69,
        falseDirectionalProbability: expect.closeTo(0.00024954884012929815, 14),
      },
    ]);
    expect(analysis.scopeLimit).toContain(
      "finite-resample implementation and real model behavior remain uncalibrated",
    );
  }, 30_000);

  it("rejects asymmetric or incomplete null-calibration rules", () => {
    const spec = buildToyPercentileNullCalibrationSpec();
    for (const candidate of [
      { ...spec, effectSupport: [-1, 1] },
      { ...spec, falseDirectionalTolerance: Number.NaN },
      { ...spec, candidateMinimumRunBlocks: 1 },
      { ...spec, reportRunBlockCounts: [2, 4, 96] },
      {
        ...spec,
        processes: [{ id: "directional", probabilities: [0.1, 0.7, 0.2] }],
      },
    ]) {
      expect(calibratePercentileNullProcesses(candidate).errors).toEqual([
        "percentile null calibration specification is invalid",
      ]);
    }
  });

  it("enumerates every finite 64-block composition against the exact oracle", () => {
    const analysis = compareFinitePercentileNullProcesses(
      buildToyPercentileNullCalibrationSpec(),
      buildToyModelRunBlockBootstrapSpec(),
      "calibration-model",
    );

    expect(analysis.ok).toBe(true);
    expect(analysis.comparisonSpecSha256).toBe(
      "83926b57b4561a0dd39e238ddf2ee010ade6818fdc38d2d6123bf0c19ab30de8",
    );
    expect(analysis.compositionCount).toBe(2145);
    expect(analysis.decisionMismatchCount).toBe(26);
    expect(analysis.mismatchExamples[0]).toEqual({
      negativeCount: 1,
      zeroCount: 49,
      positiveCount: 14,
      exactDecision: "inconclusive",
      finiteDecision: "positive",
    });
    const process = (processId: string) =>
      analysis.processes.find((entry) => entry.processId === processId)!;
    expect(
      process("balanced-null").finiteFalseDirectionalProbability,
    ).toBeCloseTo(0.003173180319440574, 14);
    expect(process("balanced-null").decisionMismatchProbability).toBeCloseTo(
      0.000867460474092118,
      14,
    );
    expect(process("dense-null")).toEqual({
      processId: "dense-null",
      exactFalseDirectionalProbability: expect.closeTo(
        0.008146902228698577,
        14,
      ),
      finiteFalseDirectionalProbability: expect.closeTo(
        0.008146902228698577,
        14,
      ),
      decisionMismatchProbability: 0,
    });
    expect(
      process("sparse-null").finiteFalseDirectionalProbability,
    ).toBeCloseTo(0.00025673753238608036, 14);
    expect(analysis.scopeLimit).toContain("resampling seed, and model ID");
  });

  it("rejects an unsafe finite-comparison identity", () => {
    expect(
      compareFinitePercentileNullProcesses(
        buildToyPercentileNullCalibrationSpec(),
        buildToyModelRunBlockBootstrapSpec(),
        "../other-model",
      ).errors,
    ).toEqual(["finite percentile comparison specification is invalid"]);
  });

  it("matches the exact dense-null decision boundary at 64 run blocks", () => {
    const seedIds = Array.from(
      { length: 64 },
      (_, index) => `boundary-run-${String(index).padStart(2, "0")}`,
    );
    const schedule = buildSyntheticFactorialSchedule(
      ["calibration-model"],
      seedIds,
    );
    const bundleFor = (
      negativeRunCount: number,
      placement: "front" | "back" | "spread",
    ) => {
      const inverseRuns = new Set(
        placement === "front"
          ? seedIds.slice(0, negativeRunCount)
          : placement === "back"
            ? seedIds.slice(seedIds.length - negativeRunCount)
            : Array.from(
                { length: negativeRunCount },
                (_, index) =>
                  seedIds[
                    Math.floor((index * seedIds.length) / negativeRunCount)
                  ]!,
              ),
      );
      return {
        schema: "scout.verification-allocation-results/v1",
        evidenceClass: "synthetic-analysis-fixture",
        scheduleSha256: scheduleSha256(schedule),
        outcomes: schedule.episodes.map((episode) => {
          const inverse = inverseRuns.has(episode.seedId);
          const current = episode.factors.targetStatus === "current";
          const selectsTarget = inverse ? !current : current;
          return {
            episodeId: episode.id,
            answer: {
              selected_memory_id: selectsTarget
                ? episode.targetMemoryId
                : episode.decoyMemoryId,
            },
          };
        }),
      };
    };

    for (const expected of [
      {
        negativeRunCount: 21,
        interval: [0.34375, 0.125, 0.5625],
        decision: "positive",
      },
      {
        negativeRunCount: 22,
        interval: [0.3125, 0.09375, 0.53125],
        decision: "inconclusive",
      },
      {
        negativeRunCount: 42,
        interval: [-0.3125, -0.53125, -0.09375],
        decision: "inconclusive",
      },
      {
        negativeRunCount: 43,
        interval: [-0.34375, -0.5625, -0.125],
        decision: "negative",
      },
    ] as const) {
      for (const placement of ["front", "back", "spread"] as const) {
        const bundle = bundleFor(expected.negativeRunCount, placement);
        const bootstrap = bootstrapFactorialModelRunBlocks(
          schedule,
          bundle,
          buildToyModelRunBlockBootstrapSpec(),
        );
        const decision = decideFactorialPracticalEffects(
          schedule,
          bundle,
          buildToyModelRunBlockBootstrapSpec(),
          buildToyPracticalEffectDecisionSpec(),
        );

        expect(bootstrap.ok).toBe(true);
        expect(
          bootstrap.models[0]!.strata.map((stratum) => [
            stratum.pointEstimate,
            stratum.lower,
            stratum.upper,
          ]),
        ).toEqual(Array.from({ length: 4 }, () => expected.interval));
        expect(decision.ok).toBe(true);
        expect(decision.strata.map((stratum) => stratum.decision)).toEqual(
          Array.from({ length: 4 }, () => expected.decision),
        );
      }
    }
  }, 30_000);
});
