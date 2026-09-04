import { describe, expect, it } from "bun:test";
import {
  analyzeFactorialOutcomes,
  analyzeFactorialResultBundle,
  bootstrapFactorialModelRunBlocks,
  boundDirectionalStrictMajority,
  boundHeterogeneousDirectionalMajority,
  buildToyDirectionalQuantileCalibrationSpec,
  buildToyDirectionalQuantilePowerSpec,
  buildToyDirectionalStrictMajoritySpec,
  buildToyHeterogeneousDirectionalMajoritySpec,
  buildToyPercentileEstimandComparisonSpec,
  buildToyPercentileUnanimousPowerSpec,
  buildToyPercentileAlternativeCalibrationSpec,
  buildToyPercentileAlternativePowerSearchSpec,
  buildToyPercentileNullCalibrationSpec,
  buildSyntheticFactorialSchedule,
  buildToyFactorialSchedule,
  buildToyModelRunBlockBootstrapSpec,
  buildToyPracticalEffectDecisionSpec,
  compareFinitePercentileNullProcesses,
  decideFactorialPracticalEffects,
  calibratePercentileAlternativeProcesses,
  calibrateDirectionalQuantiles,
  calibratePercentileNullProcesses,
  calibratePercentileUnanimousPower,
  comparePercentileEstimands,
  measureCalibratedDirectionalPower,
  searchPercentileAlternativePower,
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

  it("bounds deeply nested result answers before pooled analysis", () => {
    const schedule = buildToyFactorialSchedule();
    const bundle = {
      schema: "scout.verification-allocation-results/v1",
      evidenceClass: "synthetic-analysis-fixture",
      scheduleSha256: scheduleSha256(schedule),
      outcomes: toyPolicyOutcomes("authority", schedule),
    };
    expect(analyzeFactorialResultBundle(schedule, bundle).ok).toBe(true);

    let nested: unknown = null;
    for (let depth = 0; depth < 50_000; depth += 1) {
      nested = { value: nested };
    }
    bundle.outcomes[0]!.answer = nested;

    const result = analyzeFactorialResultBundle(schedule, bundle);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "result bundle exceeds the supported JSON nesting limit",
    ]);
    expect(result.pooled).toBeNull();
    expect(result.bundleSha256).toBe("");
  });

  it("rejects a shallow outcome flood before pooled analysis", () => {
    const schedule = buildToyFactorialSchedule();
    const bundle = {
      schema: "scout.verification-allocation-results/v1",
      evidenceClass: "synthetic-analysis-fixture",
      scheduleSha256: scheduleSha256(schedule),
      outcomes: toyPolicyOutcomes("authority", schedule),
    };
    expect(analyzeFactorialResultBundle(schedule, bundle).ok).toBe(true);

    bundle.outcomes = Array.from({ length: 50_000 }, () =>
      structuredClone(bundle.outcomes[0]!),
    );
    const result = analyzeFactorialResultBundle(schedule, bundle);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "result outcome count must match supplied schedule: expected 64, found 50000",
    ]);
    expect(result.pooled).toBeNull();
    expect(result.bundleSha256).toBe("");
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
    expect(analysis.calibrationSpecSha256).toBe(
      "6ac043cd0cab150dae665af183045dfc076cb9dfd007f1f2f5900eb8d40ffcc2",
    );
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

  it("exactly measures matched nonzero-alternative power at 64 blocks", () => {
    const analysis = calibratePercentileAlternativeProcesses(
      buildToyPercentileAlternativeCalibrationSpec(),
    );
    const process = (processId: string) =>
      analysis.report.find((entry) => entry.processId === processId)!;

    expect(analysis.ok).toBe(true);
    expect(analysis.calibrationSpecSha256).toBe(
      "22df2188523708cbe52f28ea0dbbacf30563adf2a1447a57175d04e28008f887",
    );
    expect(analysis.calibrationMethod).toBe("exact-trinomial-enumeration");
    expect(analysis.monteCarloStandardError).toBe(0);
    expect(analysis.runBlockCount).toBe(64);
    expect(analysis.report).toHaveLength(4);
    for (const entry of analysis.report) {
      expect(
        entry.correctDirectionalProbability +
          entry.wrongDirectionalProbability +
          entry.negligibleProbability +
          entry.inconclusiveProbability,
      ).toBeCloseTo(1, 12);
      expect(entry.passesWrongDirectionTolerance).toBe(true);
    }
    for (const pairId of ["moderate", "strong"]) {
      const positive = process(`${pairId}-positive`);
      const negative = process(`${pairId}-negative`);
      expect(positive.correctDirectionalProbability).toBeCloseTo(
        negative.correctDirectionalProbability,
        14,
      );
      expect(positive.wrongDirectionalProbability).toBeCloseTo(
        negative.wrongDirectionalProbability,
        14,
      );
      expect(positive.inconclusiveProbability).toBeCloseTo(
        negative.inconclusiveProbability,
        13,
      );
    }
    expect(
      process("moderate-positive").correctDirectionalProbability,
    ).toBeCloseTo(0.08407170601489997, 14);
    expect(
      process("moderate-positive").wrongDirectionalProbability,
    ).toBeCloseTo(0.0000018579349140504212, 14);
    expect(
      process("strong-positive").correctDirectionalProbability,
    ).toBeCloseTo(0.5975522317286325, 14);
    expect(process("strong-positive").wrongDirectionalProbability).toBeCloseTo(
      2.298192502702488e-10,
      14,
    );
    expect(analysis.report.every((entry) => !entry.passesPowerTarget)).toBe(
      true,
    );
  });

  it("rejects incomplete or non-mirrored alternative calibration", () => {
    const spec = buildToyPercentileAlternativeCalibrationSpec();
    for (const candidate of [
      { ...spec, processes: spec.processes.slice(1) },
      {
        ...spec,
        processes: spec.processes.map((process, index) =>
          index === 1
            ? { ...process, probabilities: [0.34, 0.46, 0.2] }
            : process,
        ),
      },
      { ...spec, minimumCorrectDirectionalPower: 1 },
      { ...spec, runBlockCount: 1 },
    ]) {
      expect(calibratePercentileAlternativeProcesses(candidate).errors).toEqual(
        ["percentile alternative calibration specification is invalid"],
      );
    }
  });

  it("finds an exact alternative-power crossing without assuming monotonicity", () => {
    const spec = {
      ...buildToyPercentileAlternativePowerSearchSpec(),
      minimumRunBlockCount: 104,
      maximumRunBlockCount: 105,
      reportRunBlockCounts: [104, 105],
    };
    const analysis = searchPercentileAlternativePower(spec);
    const pair = (pairId: string) =>
      analysis.pairs.find((entry) => entry.pairId === pairId)!;
    const process = (runBlockCount: number, processId: string) =>
      analysis.report
        .find((entry) => entry.runBlockCount === runBlockCount)!
        .processes.find((entry) => entry.processId === processId)!;

    expect(analysis.ok).toBe(true);
    expect(analysis.searchSpecSha256).toBe(
      "8332fbce020cff46e5df660be6cd9c742d1b2d43063693ac3e59e69a427d8213",
    );
    expect(analysis.calibrationMethod).toBe("exact-trinomial-enumeration");
    expect(analysis.monteCarloStandardError).toBe(0);
    expect(analysis.scannedRunBlockCounts).toEqual({
      minimum: 104,
      maximum: 105,
      total: 2,
    });
    expect(pair("strong").firstPassingRunBlockCount).toBe(105);
    expect(pair("strong").passesPowerWithinRange).toBe(true);
    expect(pair("moderate").firstPassingRunBlockCount).toBeNull();
    expect(pair("moderate").passesPowerWithinRange).toBe(false);
    expect(
      process(104, "strong-positive").correctDirectionalProbability,
    ).toBeCloseTo(0.7973065499459407, 14);
    expect(
      process(105, "strong-positive").correctDirectionalProbability,
    ).toBeCloseTo(0.8045178323414782, 14);
    for (const run of analysis.report) {
      expect(run.processes).toHaveLength(4);
      for (const entry of run.processes) {
        expect(
          entry.correctDirectionalProbability +
            entry.wrongDirectionalProbability +
            entry.negligibleProbability +
            entry.inconclusiveProbability,
        ).toBeCloseTo(1, 12);
      }
    }
    expect(analysis.scopeLimit).toContain("80% target is synthetic");
  }, 30_000);

  it("rejects incomplete alternative-power search bounds", () => {
    const spec = buildToyPercentileAlternativePowerSearchSpec();
    for (const candidate of [
      { ...spec, minimumRunBlockCount: 1 },
      { ...spec, maximumRunBlockCount: 257 },
      { ...spec, reportRunBlockCounts: [64, 64, 256] },
      { ...spec, reportRunBlockCounts: [63, 256] },
      { ...spec, processes: spec.processes.slice(1) },
    ]) {
      expect(searchPercentileAlternativePower(candidate).errors).toEqual([
        "percentile alternative power-search specification is invalid",
      ]);
    }
  });

  it("bounds unanimous named-model power without assuming independence", () => {
    const analysis = calibratePercentileUnanimousPower(
      buildToyPercentileUnanimousPowerSpec(),
    );
    const process = (processId: string) =>
      analysis.report.find((entry) => entry.processId === processId)!;
    const strong = process("strong-positive");

    expect(analysis.ok).toBe(true);
    expect(analysis.unanimousPowerSpecSha256).toBe(
      "438cb3dc3964a76de7927ffa43eea7423fa6ae1dc025e66eefe8d40a186827ff",
    );
    expect(analysis.perModelCalibrationSpecSha256).toBe(
      "6cf0c60769fc8d0691fac797a4439eaae5b728a6826824f055e1d708a0c96bbc",
    );
    expect(analysis.dependenceTreatment).toBe(
      "unknown-frechet-bounds-with-independent-illustration",
    );
    expect(analysis.modelCount).toBe(6);
    expect(analysis.runBlockCountPerModel).toBe(105);
    expect(analysis.requiredPerModelPowerForGuaranteedUnanimity).toBeCloseTo(
      0.9666666666666667,
      14,
    );
    expect(
      analysis.requiredPerModelPowerUnderIndependentIllustration,
    ).toBeCloseTo(0.9634924839989961, 14);
    expect(strong.perModelCorrectDirectionalProbability).toBeCloseTo(
      0.8045178323414782,
      14,
    );
    expect(strong.unanimousCorrectDirectionalLowerBound).toBe(0);
    expect(strong.unanimousCorrectDirectionalUpperBound).toBeCloseTo(
      0.8045178323414782,
      14,
    );
    expect(strong.independentCorrectDirectionalIllustration).toBeCloseTo(
      0.2711527720864071,
      14,
    );
    expect(strong.unanimousWrongDirectionalLowerBound).toBe(0);
    expect(strong.unanimousWrongDirectionalUpperBound).toBeCloseTo(
      4.462239207721462e-14,
      14,
    );
    expect(strong.passesGuaranteedUnanimousPowerTarget).toBe(false);
    expect(strong.passesIndependentIllustrationPowerTarget).toBe(false);
    expect(
      analysis.report.every(
        (entry) => !entry.passesGuaranteedUnanimousPowerTarget,
      ),
    ).toBe(true);
    expect(analysis.scopeLimit).toContain("aggregate-interval support");
  });

  it("passes unanimous-power bounds only when the lower bound reaches target", () => {
    const spec = buildToyPercentileUnanimousPowerSpec();
    const analysis = calibratePercentileUnanimousPower({
      ...spec,
      perModelCalibration: {
        ...spec.perModelCalibration,
        runBlockCount: 2,
        processes: [
          {
            id: "deterministic-positive",
            pairId: "deterministic",
            expectedDirection: "positive",
            probabilities: [0, 0, 1],
          },
          {
            id: "deterministic-negative",
            pairId: "deterministic",
            expectedDirection: "negative",
            probabilities: [1, 0, 0],
          },
        ],
      },
    });

    expect(analysis.ok).toBe(true);
    for (const entry of analysis.report) {
      expect(entry.perModelCorrectDirectionalProbability).toBe(1);
      expect(entry.unanimousCorrectDirectionalLowerBound).toBe(1);
      expect(entry.unanimousCorrectDirectionalUpperBound).toBe(1);
      expect(entry.independentCorrectDirectionalIllustration).toBe(1);
      expect(entry.passesGuaranteedUnanimousPowerTarget).toBe(true);
      expect(entry.passesIndependentIllustrationPowerTarget).toBe(true);
    }
  });

  it("rejects an unfrozen unanimous-power contract", () => {
    const spec = buildToyPercentileUnanimousPowerSpec();
    for (const candidate of [
      { ...spec, modelCount: 1 },
      { ...spec, modelCount: 33 },
      { ...spec, minimumUnanimousCorrectDirectionalPower: 1 },
      { ...spec, dependenceTreatment: "independent" },
      {
        ...spec,
        perModelCalibration: {
          ...spec.perModelCalibration,
          runBlockCount: 1,
        },
      },
    ]) {
      expect(calibratePercentileUnanimousPower(candidate).errors).toEqual([
        "percentile unanimous-power specification is invalid",
      ]);
    }
  });

  it("compares directional and practical estimands under matched exact controls", () => {
    const analysis = comparePercentileEstimands(
      buildToyPercentileEstimandComparisonSpec(),
    );
    const directional = analysis.estimands.find(
      (entry) => entry.estimand === "directional",
    )!;
    const practical = analysis.estimands.find(
      (entry) => entry.estimand === "practical-exceedance",
    )!;

    expect(analysis.ok).toBe(true);
    expect(analysis.comparisonSpecSha256).toBe(
      "465a3c1041b4dce920f323df04e50276aeac0e1c7f804ed1dbd356d751de1542",
    );
    expect(
      buildToyPercentileEstimandComparisonSpec()
        .maximumWrongDirectionalProbability,
    ).toBe(0.01);
    expect(analysis.calibrationMethod).toBe("exact-trinomial-enumeration");
    expect(analysis.monteCarloStandardError).toBe(0);
    expect(analysis.runBlockCount).toBe(105);
    expect(directional.decisionDelta).toBe(0);
    expect(practical.decisionDelta).toBe(0.1);
    expect(directional.nullReport).toHaveLength(4);
    expect(directional.alternativeReport).toHaveLength(4);
    expect(
      directional.nullReport
        .filter((entry) => entry.expectedEffect === 0)
        .every((entry) => !entry.passesWrongDirectionTolerance),
    ).toBe(true);
    expect(
      practical.nullReport
        .filter((entry) => entry.expectedEffect === 0)
        .every((entry) => entry.passesWrongDirectionTolerance),
    ).toBe(true);
    const nullDecisionRates = (
      report: typeof directional.nullReport,
      processId: string,
    ) => {
      const entry = report.find(
        (candidate) => candidate.processId === processId,
      )!;
      return [
        entry.positiveDecisionProbability,
        entry.negativeDecisionProbability,
        entry.falseDirectionalProbability,
      ];
    };
    expect(nullDecisionRates(directional.nullReport, "balanced-null")).toEqual([
      expect.closeTo(0.0224673763533166, 14),
      expect.closeTo(0.02246737635331652, 14),
      expect.closeTo(0.04493475270663312, 14),
    ]);
    expect(nullDecisionRates(directional.nullReport, "dense-null")).toEqual([
      expect.closeTo(0.025221078319989557, 14),
      expect.closeTo(0.02522107831998931, 14),
      expect.closeTo(0.05044215663997886, 14),
    ]);
    expect(nullDecisionRates(directional.nullReport, "sparse-null")).toEqual([
      expect.closeTo(0.021339991156998733, 14),
      expect.closeTo(0.021339991156998687, 14),
      expect.closeTo(0.04267998231399742, 14),
    ]);
    expect(
      nullDecisionRates(
        directional.nullReport,
        "positive-practical-boundary-null",
      ),
    ).toEqual([
      expect.closeTo(0.289256693611456, 14),
      expect.closeTo(0.00027161058571514634, 14),
      expect.closeTo(0.00027161058571514634, 14),
    ]);
    expect(nullDecisionRates(practical.nullReport, "balanced-null")).toEqual([
      expect.closeTo(0.00040765099445983454, 14),
      expect.closeTo(0.0004076509944598306, 14),
      expect.closeTo(0.0008153019889196652, 14),
    ]);
    expect(nullDecisionRates(practical.nullReport, "dense-null")).toEqual([
      expect.closeTo(0.0016104949343995274, 14),
      expect.closeTo(0.0016104949343995292, 14),
      expect.closeTo(0.0032209898687990566, 14),
    ]);
    expect(nullDecisionRates(practical.nullReport, "sparse-null")).toEqual([
      expect.closeTo(0.00001203362988695852, 14),
      expect.closeTo(0.000012033629886958369, 14),
      expect.closeTo(0.000024067259773916887, 14),
    ]);
    expect(
      nullDecisionRates(
        practical.nullReport,
        "positive-practical-boundary-null",
      ),
    ).toEqual([
      expect.closeTo(0.028051868524189363, 14),
      expect.closeTo(7.753540473255935e-7, 14),
      expect.closeTo(0.028052643878236687, 14),
    ]);
    const directionalBoundary = directional.nullReport.find(
      (entry) => entry.processId === "positive-practical-boundary-null",
    )!;
    const practicalBoundary = practical.nullReport.find(
      (entry) => entry.processId === "positive-practical-boundary-null",
    )!;
    expect(directionalBoundary.expectedEffect).toBeCloseTo(0.1, 14);
    expect(directionalBoundary.falsePositiveDirectionProbability).toBe(0);
    expect(directionalBoundary.passesWrongDirectionTolerance).toBe(true);
    expect(practicalBoundary.passesWrongDirectionTolerance).toBe(false);
    for (const directionalProcess of directional.alternativeReport) {
      const practicalProcess = practical.alternativeReport.find(
        (entry) => entry.processId === directionalProcess.processId,
      )!;
      expect(directionalProcess.correctDirectionalProbability).toBeGreaterThan(
        practicalProcess.correctDirectionalProbability,
      );
      expect(
        directionalProcess.correctDirectionalProbability +
          directionalProcess.wrongDirectionalProbability +
          directionalProcess.negligibleProbability +
          directionalProcess.inconclusiveProbability,
      ).toBeCloseTo(1, 12);
      expect(
        practicalProcess.correctDirectionalProbability +
          practicalProcess.wrongDirectionalProbability +
          practicalProcess.negligibleProbability +
          practicalProcess.inconclusiveProbability,
      ).toBeCloseTo(1, 12);
    }
    expect(
      directional.alternativeReport.find(
        (entry) => entry.processId === "strong-positive",
      )!.correctDirectionalProbability,
    ).toBeCloseTo(0.9845896004887843, 14);
    expect(
      directional.alternativeReport.find(
        (entry) => entry.processId === "moderate-positive",
      )!.correctDirectionalProbability,
    ).toBeCloseTo(0.5344140683113935, 14);
    expect(
      practical.alternativeReport.find(
        (entry) => entry.processId === "strong-positive",
      )!.correctDirectionalProbability,
    ).toBeCloseTo(0.8045178323414782, 14);
    expect(
      practical.alternativeReport.find(
        (entry) => entry.processId === "moderate-positive",
      )!.correctDirectionalProbability,
    ).toBeCloseTo(0.11132478415415377, 14);
    expect(analysis.scopeLimit).toContain(
      "false-direction accounting is estimand-specific",
    );
  });

  it("rejects an unfrozen estimand comparison", () => {
    const spec = buildToyPercentileEstimandComparisonSpec();
    for (const candidate of [
      { ...spec, directionalDecisionDelta: 0.01 },
      { ...spec, practicalDecisionDelta: 0 },
      { ...spec, maximumWrongDirectionalProbability: 0.02 },
      { ...spec, runBlockCount: 257 },
      { ...spec, nullProcesses: spec.nullProcesses.slice(0, 3) },
      {
        ...spec,
        nullProcesses: spec.nullProcesses.map((process, index) =>
          index === 0
            ? { ...process, probabilities: [0.2, 0.4, 0.4] }
            : process,
        ),
      },
      { ...spec, alternativeProcesses: spec.alternativeProcesses.slice(1) },
      {
        ...spec,
        alternativeProcesses: spec.alternativeProcesses.map((process, index) =>
          index === 0 ? { ...process, id: spec.nullProcesses[0]!.id } : process,
        ),
      },
    ]) {
      expect(comparePercentileEstimands(candidate).errors).toEqual([
        "percentile estimand-comparison specification is invalid",
      ]);
    }
  });

  it("selects a stricter directional interval from nulls before measuring power", () => {
    const calibrationSpec = buildToyDirectionalQuantileCalibrationSpec();
    const calibration = calibrateDirectionalQuantiles(calibrationSpec);

    expect(calibration.ok).toBe(true);
    expect(calibration.calibrationSpecSha256).toBe(
      "1d8633f0591d9e4a1cd7c2fdc919a9546a26edf27a9761ab3ce113ab815b2ba8",
    );
    expect(calibration.monteCarloStandardError).toBe(0);
    expect(calibration.candidates.map((entry) => entry.passesAllNulls)).toEqual(
      [false, false, false, true],
    );
    expect(calibration.selectedLowerQuantile).toBe(0.0025);
    expect(calibration.selectedUpperQuantile).toBe(0.9975);
    const selected = calibration.candidates[3]!;
    expect(
      selected.nullReport.map((entry) => entry.falseDirectionalProbability),
    ).toEqual([
      expect.closeTo(0.004746432583487716, 14),
      expect.closeTo(0.006016081515250353, 14),
      expect.closeTo(0.004673936662618542, 14),
    ]);

    const power = measureCalibratedDirectionalPower(
      calibrationSpec,
      buildToyDirectionalQuantilePowerSpec(calibration),
    );
    const process = (processId: string) =>
      power.report.find((entry) => entry.processId === processId)!;
    expect(power.ok).toBe(true);
    expect(power.powerSpecSha256).toBe(
      "b5715c37201d532faf4067286232fe390e959b98b76651958b3a0cb3a693bef9",
    );
    expect(power.calibrationSpecSha256).toBe(calibration.calibrationSpecSha256);
    expect(
      process("strong-positive").correctDirectionalProbability,
    ).toBeCloseTo(0.9066218357309971, 14);
    expect(
      process("moderate-positive").correctDirectionalProbability,
    ).toBeCloseTo(0.2298628645622084, 14);
    expect(process("strong-positive").passesPowerTarget).toBe(true);
    expect(process("moderate-positive").passesPowerTarget).toBe(false);
    expect(
      power.report.every((entry) => entry.passesWrongDirectionTolerance),
    ).toBe(true);
  }, 30_000);

  it("rejects unfrozen quantile selection, unbound power, and cross-class IDs", () => {
    const calibrationSpec = buildToyDirectionalQuantileCalibrationSpec();
    expect(
      calibrateDirectionalQuantiles({
        ...calibrationSpec,
        candidateLowerQuantiles: [0.01, 0.025],
      }).errors,
    ).toEqual(["directional quantile calibration specification is invalid"]);

    const calibration = calibrateDirectionalQuantiles(calibrationSpec);
    const powerSpec = buildToyDirectionalQuantilePowerSpec(calibration);
    expect(
      measureCalibratedDirectionalPower(calibrationSpec, {
        ...powerSpec,
        selectedLowerQuantile: 0.005,
      }).errors,
    ).toEqual([
      "directional quantile power specification is invalid or not bound to the selected null calibration",
    ]);
    expect(
      measureCalibratedDirectionalPower(calibrationSpec, {
        ...powerSpec,
        alternativeProcesses: powerSpec.alternativeProcesses.map(
          (process, index) =>
            index === 0
              ? { ...process, id: calibrationSpec.nullProcesses[0]!.id }
              : process,
        ),
      }).errors,
    ).toEqual([
      "directional quantile power specification is invalid or not bound to the selected null calibration",
    ]);
  }, 30_000);

  it("bounds the smallest strict majority without assuming model independence", () => {
    const analysis = boundDirectionalStrictMajority(
      buildToyDirectionalStrictMajoritySpec(),
    );
    const process = (processId: string) =>
      analysis.report.find((entry) => entry.processId === processId)!;

    expect(analysis.ok).toBe(true);
    expect(analysis.majoritySpecSha256).toBe(
      "f2263724b736580c776796983ca0df095e06eefd793a3347868f69bf58196dca",
    );
    expect(analysis.modelCount).toBe(6);
    expect(analysis.minimumSupportingModels).toBe(4);
    expect(analysis.directionConflictStructurallyImpossible).toBe(true);
    expect(analysis.runBlockCountPerModel).toBe(105);
    expect(analysis.completeFactorialEpisodeCount).toBe(20_160);
    expect(
      process("strong-positive").aggregateCorrectDirectionalLowerBound,
    ).toBeCloseTo(0.813243671461994, 14);
    expect(
      process("strong-positive").aggregateWrongDirectionalUpperBound,
    ).toBeCloseTo(2.0779570981567675e-12, 20);
    expect(process("strong-positive").passesAggregatePowerTarget).toBe(true);
    expect(
      process("moderate-positive").aggregateCorrectDirectionalLowerBound,
    ).toBe(0);
    expect(
      process("moderate-positive").aggregateCorrectDirectionalUpperBound,
    ).toBeCloseTo(0.3447942968433126, 14);
    expect(process("moderate-positive").passesAggregatePowerTarget).toBe(false);
    expect(
      analysis.report.every(
        (entry) => entry.passesAggregateWrongDirectionTolerance,
      ),
    ).toBe(true);
  }, 30_000);

  it("rejects a non-majority threshold and an unbound nested calibration", () => {
    const spec = buildToyDirectionalStrictMajoritySpec();
    expect(
      boundDirectionalStrictMajority({
        ...spec,
        minimumSupportingModels: 3,
      }).errors,
    ).toEqual(["directional strict-majority specification is invalid"]);
    expect(
      boundDirectionalStrictMajority({
        ...spec,
        perModelPowerSpec: {
          ...spec.perModelPowerSpec,
          calibrationSpecSha256: "0".repeat(64),
        },
      }).errors,
    ).toEqual([
      "per-model calibration: directional quantile power specification is invalid or not bound to the selected null calibration",
    ]);
  }, 30_000);

  it("bounds named heterogeneous model marginals without assuming independence", () => {
    const analysis = boundHeterogeneousDirectionalMajority(
      buildToyHeterogeneousDirectionalMajoritySpec(),
    );
    const scenario = (scenarioId: string) =>
      analysis.report.find((entry) => entry.scenarioId === scenarioId)!;

    expect(analysis.ok).toBe(true);
    expect(analysis.sensitivitySpecSha256).toBe(
      "10dec5699c1ce2d83502e0fb8d4025d0c1a735e6e8aee242c9528823176654a6",
    );
    expect(analysis.sourceNullRangeSpecSha256).toBe(
      "3d88ae647a7602f66779c114a577df96d61d4f67226ea9fec59bd1ad16691ca5",
    );
    expect(analysis.sourcePowerSearchSpecSha256).toBe(
      "bbd889086dc4dbeb8c6f6f119a61a3fce71146110a9e3abc325d93edccd7f22f",
    );
    expect(analysis.runBlockCount).toBe(104);
    expect(analysis.modelCount).toBe(6);
    expect(analysis.minimumSupportingModels).toBe(4);
    expect(analysis.totalCorrectMarginalRequired).toBe(5.4);
    expect(analysis.directionConflictStructurallyImpossible).toBe(true);
    expect(scenario("all-strong")).toEqual({
      scenarioId: "all-strong",
      correctMarginalSum: 5.418289235832395,
      aggregateCorrectDirectionalLowerBound: 0.8060964119441317,
      aggregateCorrectDirectionalUpperBound: 1,
      wrongMarginalSum: 9.514585258259864e-12,
      aggregateWrongDirectionalLowerBound: 0,
      aggregateWrongDirectionalUpperBound: 2.378646314564966e-12,
      passesAggregatePowerTarget: true,
      passesAggregateWrongDirectionTolerance: true,
    });
    expect(scenario("one-moderate")).toEqual({
      scenarioId: "one-moderate",
      correctMarginalSum: 4.741618246106212,
      aggregateCorrectDirectionalLowerBound: 0.5805394153687372,
      aggregateCorrectDirectionalUpperBound: 1,
      wrongMarginalSum: 4.913592570632241e-7,
      aggregateWrongDirectionalLowerBound: 0,
      aggregateWrongDirectionalUpperBound: 1.2283981426580603e-7,
      passesAggregatePowerTarget: false,
      passesAggregateWrongDirectionTolerance: true,
    });
    expect(scenario("two-moderate")).toEqual({
      scenarioId: "two-moderate",
      correctMarginalSum: 4.064947256380029,
      aggregateCorrectDirectionalLowerBound: 0.3549824187933431,
      aggregateCorrectDirectionalUpperBound: 1,
      wrongMarginalSum: 9.827089995411897e-7,
      aggregateWrongDirectionalLowerBound: 0,
      aggregateWrongDirectionalUpperBound: 2.4567724988529744e-7,
      passesAggregatePowerTarget: false,
      passesAggregateWrongDirectionTolerance: true,
    });
    expect(
      analysis.report.every(
        (entry) => entry.passesAggregateWrongDirectionTolerance,
      ),
    ).toBe(true);
    expect(analysis.scopeLimit).toContain(
      "moderate-process substitution is a stress control",
    );
  });

  it("rejects malformed heterogeneous model identities and probability envelopes", () => {
    const spec = buildToyHeterogeneousDirectionalMajoritySpec();
    const missingMarginal = structuredClone(spec);
    missingMarginal.scenarios[0]!.marginals.pop();
    const duplicateMarginal = structuredClone(spec);
    duplicateMarginal.scenarios[0]!.marginals[0]!.modelId =
      duplicateMarginal.scenarios[0]!.marginals[1]!.modelId;
    const invalidEnvelope = structuredClone(spec);
    invalidEnvelope.scenarios[0]!.marginals[0] = {
      ...invalidEnvelope.scenarios[0]!.marginals[0]!,
      correctDirectionalProbability: 0.8,
      wrongDirectionalProbability: 0.3,
    };
    for (const candidate of [
      { ...spec, modelIds: [...spec.modelIds.slice(0, -1), spec.modelIds[0]!] },
      { ...spec, minimumSupportingModels: 3 },
      missingMarginal,
      duplicateMarginal,
      invalidEnvelope,
    ]) {
      expect(boundHeterogeneousDirectionalMajority(candidate).errors).toEqual([
        "heterogeneous directional-majority specification is invalid",
      ]);
    }
  });

  it("pins the weakest-model and graded-vector 80% boundaries", () => {
    const base = buildToyHeterogeneousDirectionalMajoritySpec();
    const strongMarginal = 0.9030482059720658;
    const wrongDirectionalMarginal = 1.5857642097099773e-12;
    const weakestMarginal = 5.4 - 5 * strongMarginal;
    const analyze = (id: string, correctMarginals: number[]) =>
      boundHeterogeneousDirectionalMajority({
        ...base,
        scenarios: [
          {
            id,
            evidenceClass: "synthetic-sensitivity-control",
            marginals: base.modelIds.map((modelId, index) => ({
              modelId,
              correctDirectionalProbability: correctMarginals[index],
              wrongDirectionalProbability: wrongDirectionalMarginal,
            })),
          },
        ],
      });

    expect(weakestMarginal).toBe(0.8847589701396714);
    const weakestBoundary = analyze("single-weak-boundary", [
      strongMarginal,
      strongMarginal,
      strongMarginal,
      strongMarginal,
      strongMarginal,
      weakestMarginal,
    ]);
    expect(weakestBoundary.sensitivitySpecSha256).toBe(
      "94ebee148ee1ae7c0b4a905a83efe39efae606df46113bbb58ed159851938ffb",
    );
    expect(weakestBoundary.report[0]).toMatchObject({
      correctMarginalSum: 5.4,
      aggregateCorrectDirectionalLowerBound: 0.8000000000000002,
      passesAggregatePowerTarget: true,
    });

    const gradedBoundary = analyze(
      "graded-boundary",
      [0.88, 0.89, 0.9, 0.91, 0.92, 0.9],
    );
    expect(gradedBoundary.sensitivitySpecSha256).toBe(
      "dd37d582b2347f573fadddf0c394a4ff22f0feb7d139b2d1263d3b745c1c30d1",
    );
    expect(gradedBoundary.report[0]).toMatchObject({
      correctMarginalSum: 5.4,
      aggregateCorrectDirectionalLowerBound: 0.8000000000000002,
      passesAggregatePowerTarget: true,
    });

    const gradedBelow = analyze(
      "graded-below",
      [0.879, 0.89, 0.9, 0.91, 0.92, 0.9],
    );
    expect(gradedBelow.sensitivitySpecSha256).toBe(
      "fd54d04de55d8c9594f8f1116b8bf903ad39b493d27dde05110c1ca85ca5a1e0",
    );
    expect(gradedBelow.report[0]).toMatchObject({
      correctMarginalSum: 5.399000000000001,
      aggregateCorrectDirectionalLowerBound: 0.799666666666667,
      passesAggregatePowerTarget: false,
    });
  });

  it("pins the first five-strong one-moderate 80% recovery", () => {
    const base = buildToyHeterogeneousDirectionalMajoritySpec();
    const analyze = (runBlockCount: number) => {
      const calibrationSpec = {
        ...buildToyDirectionalQuantileCalibrationSpec(),
        runBlockCount,
        candidateLowerQuantiles: [0.0025],
      };
      const calibration = calibrateDirectionalQuantiles(calibrationSpec);
      const power = measureCalibratedDirectionalPower(
        calibrationSpec,
        buildToyDirectionalQuantilePowerSpec(calibration),
      );
      const strong = power.report.find(
        (entry) => entry.processId === "strong-positive",
      )!;
      const moderate = power.report.find(
        (entry) => entry.processId === "moderate-positive",
      )!;
      const majority = boundHeterogeneousDirectionalMajority({
        ...base,
        runBlockCount,
        sourceNullRangeSpecSha256: calibration.calibrationSpecSha256,
        sourcePowerSearchSpecSha256: power.powerSpecSha256,
        scenarios: [
          {
            id: "five-strong-one-moderate",
            evidenceClass: "synthetic-sensitivity-control",
            marginals: base.modelIds.map((modelId, index) => {
              const process =
                index === base.modelIds.length - 1 ? moderate : strong;
              return {
                modelId,
                correctDirectionalProbability:
                  process.correctDirectionalProbability,
                wrongDirectionalProbability:
                  process.wrongDirectionalProbability,
              };
            }),
          },
        ],
      });
      return { calibration, power, strong, moderate, majority };
    };

    const before = analyze(171);
    expect(before.calibration.calibrationSpecSha256).toBe(
      "486655fa1d6d62ead8a1dfdde7a42e837568257b6535751e39b833ea83c780c4",
    );
    expect(before.power.powerSpecSha256).toBe(
      "26f5470256c25d712c382a8991bc39d1d16b95421274f6ed03f6a8e5ecbf3d5e",
    );
    expect(before.strong.correctDirectionalProbability).toBeCloseTo(
      0.9931639463253574,
      14,
    );
    expect(before.moderate.correctDirectionalProbability).toBeCloseTo(
      0.43334150555065293,
      14,
    );
    expect(before.majority.report[0]).toMatchObject({
      correctMarginalSum: expect.closeTo(5.399161237177441, 14),
      aggregateCorrectDirectionalLowerBound: expect.closeTo(
        0.7997204123924803,
        14,
      ),
      passesAggregatePowerTarget: false,
      passesAggregateWrongDirectionTolerance: true,
    });

    const recovery = analyze(172);
    expect(recovery.calibration.calibrationSpecSha256).toBe(
      "a0e0d92ee7ae22dad567a1c183b7014427b163364284fb9cf71ae0a9c4d8743e",
    );
    expect(recovery.power.powerSpecSha256).toBe(
      "956ad848625656668306eebc86bdab6aada0516f94952bdb4048697a4c32295c",
    );
    expect(recovery.strong.correctDirectionalProbability).toBeCloseTo(
      0.9934576391929748,
      14,
    );
    expect(recovery.moderate.correctDirectionalProbability).toBeCloseTo(
      0.43646480159465734,
      14,
    );
    expect(recovery.majority.report[0]).toMatchObject({
      correctMarginalSum: expect.closeTo(5.403752997559532, 14),
      aggregateCorrectDirectionalLowerBound: expect.closeTo(
        0.8012509991865105,
        14,
      ),
      passesAggregatePowerTarget: true,
      passesAggregateWrongDirectionTolerance: true,
    });

    const identityInvariant = boundHeterogeneousDirectionalMajority({
      ...base,
      runBlockCount: 172,
      sourceNullRangeSpecSha256: recovery.calibration.calibrationSpecSha256,
      sourcePowerSearchSpecSha256: recovery.power.powerSpecSha256,
      scenarios: base.modelIds.map((_, moderateIndex) => ({
        id: `moderate-at-${moderateIndex + 1}`,
        evidenceClass: "synthetic-sensitivity-control",
        marginals: base.modelIds.map((modelId, modelIndex) => {
          const process =
            modelIndex === moderateIndex ? recovery.moderate : recovery.strong;
          return {
            modelId,
            correctDirectionalProbability:
              process.correctDirectionalProbability,
            wrongDirectionalProbability: process.wrongDirectionalProbability,
          };
        }),
      })),
    });
    expect(identityInvariant.sensitivitySpecSha256).toBe(
      "a7a31b9d54011af60a523b154d25127d2dc0e230ff40f9c5c0509725e8260328",
    );
    expect(identityInvariant.report).toHaveLength(6);
    for (const scenario of identityInvariant.report) {
      expect(scenario.correctMarginalSum).toBeCloseTo(5.403752997559532, 14);
      expect(scenario.aggregateCorrectDirectionalLowerBound).toBeCloseTo(
        0.8012509991865105,
        14,
      );
      expect(scenario.aggregateWrongDirectionalUpperBound).toBeCloseTo(
        4.567335716582027e-9,
        16,
      );
      expect(scenario.passesAggregatePowerTarget).toBe(true);
      expect(scenario.passesAggregateWrongDirectionTolerance).toBe(true);
    }
    const robustnessPremiumRunBlocks = base.modelIds.length * 172 - 859;
    expect(robustnessPremiumRunBlocks).toBe(173);
    expect(robustnessPremiumRunBlocks * 32).toBe(5_536);

    const heterogeneousCounts = (runBlockCounts: number[]) =>
      runBlockCounts.map((_, moderateIndex) => {
        let correctMarginalSum = 0;
        let wrongMarginalSum = 0;
        runBlockCounts.forEach((runBlockCount, modelIndex) => {
          const analysis =
            runBlockCount === 171
              ? before
              : runBlockCount === 172
                ? recovery
                : undefined;
          if (!analysis) throw new Error("unexpected robust-control count");
          const process =
            modelIndex === moderateIndex ? analysis.moderate : analysis.strong;
          correctMarginalSum += process.correctDirectionalProbability;
          wrongMarginalSum += process.wrongDirectionalProbability;
        });
        return {
          correctMarginalSum,
          aggregateCorrectDirectionalLowerBound: Math.max(
            0,
            (correctMarginalSum - 3) / 3,
          ),
          aggregateWrongDirectionalUpperBound: Math.min(
            1,
            wrongMarginalSum / 4,
          ),
        };
      });

    const robustCandidate = heterogeneousCounts([171, 171, 171, 172, 172, 172]);
    expect(
      Math.min(...robustCandidate.map((entry) => entry.correctMarginalSum)),
    ).toBeCloseTo(5.400042315780292, 14);
    expect(
      Math.min(
        ...robustCandidate.map(
          (entry) => entry.aggregateCorrectDirectionalLowerBound,
        ),
      ),
    ).toBeCloseTo(0.8000141052600972, 14);
    expect(
      Math.max(
        ...robustCandidate.map(
          (entry) => entry.aggregateWrongDirectionalUpperBound,
        ),
      ),
    ).toBeCloseTo(4.778429753042595e-9, 16);
    expect(robustCandidate).toHaveLength(6);
    expect(
      robustCandidate.every(
        (entry) => entry.aggregateCorrectDirectionalLowerBound >= 0.8,
      ),
    ).toBe(true);
    expect(
      robustCandidate.every(
        (entry) => entry.aggregateWrongDirectionalUpperBound <= 0.01,
      ),
    ).toBe(true);
    expect(171 * 3 + 172 * 3).toBe(1_029);
    expect((171 * 3 + 172 * 3) * 32).toBe(32_928);

    const applyUniformCorrectMarginalDrift = (
      scenarios: typeof robustCandidate,
      downwardDrift: number,
    ) =>
      scenarios.map((scenario) => {
        const correctMarginalSum =
          scenario.correctMarginalSum - base.modelIds.length * downwardDrift;
        return {
          correctMarginalSum,
          aggregateCorrectDirectionalLowerBound: Math.max(
            0,
            (correctMarginalSum - 3) / 3,
          ),
          aggregateWrongDirectionalUpperBound:
            scenario.aggregateWrongDirectionalUpperBound,
        };
      });
    const equalAllocation = identityInvariant.report.map((scenario) => ({
      correctMarginalSum: scenario.correctMarginalSum,
      aggregateCorrectDirectionalLowerBound:
        scenario.aggregateCorrectDirectionalLowerBound,
      aggregateWrongDirectionalUpperBound:
        scenario.aggregateWrongDirectionalUpperBound,
    }));
    const minimumPassingMarginalSum = 5.4;
    const uniformDriftBuffer = (scenarios: typeof robustCandidate) =>
      (Math.min(...scenarios.map((scenario) => scenario.correctMarginalSum)) -
        minimumPassingMarginalSum) /
      base.modelIds.length;
    const robustUniformDriftBuffer = uniformDriftBuffer(robustCandidate);
    const equalUniformDriftBuffer = uniformDriftBuffer(equalAllocation);
    expect(robustUniformDriftBuffer).toBeCloseTo(0.000007052630048557755, 18);
    expect(equalUniformDriftBuffer).toBeCloseTo(0.0006254995932550855, 18);
    expect(equalUniformDriftBuffer / robustUniformDriftBuffer).toBeCloseTo(
      88.69026008006738,
      12,
    );

    const expectPassAtButNotBeyondUniformDrift = (
      scenarios: typeof robustCandidate,
      downwardDrift: number,
    ) => {
      const atBoundary = applyUniformCorrectMarginalDrift(
        scenarios,
        downwardDrift,
      );
      expect(
        Math.min(
          ...atBoundary.map(
            (scenario) => scenario.aggregateCorrectDirectionalLowerBound,
          ),
        ),
      ).toBeCloseTo(0.8, 14);
      expect(
        atBoundary.every(
          (scenario) =>
            scenario.aggregateCorrectDirectionalLowerBound >= 0.8 &&
            scenario.aggregateWrongDirectionalUpperBound <= 0.01,
        ),
      ).toBe(true);
      expect(
        applyUniformCorrectMarginalDrift(scenarios, downwardDrift + 1e-12).some(
          (scenario) => scenario.aggregateCorrectDirectionalLowerBound < 0.8,
        ),
      ).toBe(true);
    };
    expectPassAtButNotBeyondUniformDrift(
      robustCandidate,
      robustUniformDriftBuffer,
    );
    expectPassAtButNotBeyondUniformDrift(
      equalAllocation,
      equalUniformDriftBuffer,
    );

    const localCostDriftFrontier = Array.from(
      { length: base.modelIds.length + 1 },
      (_, count172) => {
        const scenarios = heterogeneousCounts([
          ...Array(base.modelIds.length - count172).fill(171),
          ...Array(count172).fill(172),
        ]);
        const runBlockCount = 171 * base.modelIds.length + count172;
        return {
          runBlockCount,
          episodeCount: runBlockCount * 32,
          uniformDriftBuffer: uniformDriftBuffer(scenarios),
        };
      },
    );
    expect(localCostDriftFrontier).toEqual([
      {
        runBlockCount: 1_026,
        episodeCount: 32_832,
        uniformDriftBuffer: -0.00013979380376009468,
      },
      {
        runBlockCount: 1_027,
        episodeCount: 32_864,
        uniformDriftBuffer: -0.00009084499249064255,
      },
      {
        runBlockCount: 1_028,
        episodeCount: 32_896,
        uniformDriftBuffer: -0.00004189618122089437,
      },
      {
        runBlockCount: 1_029,
        episodeCount: 32_928,
        uniformDriftBuffer: 0.000007052630048557755,
      },
      {
        runBlockCount: 1_030,
        episodeCount: 32_960,
        uniformDriftBuffer: 0.00005600144131830594,
      },
      {
        runBlockCount: 1_031,
        episodeCount: 32_992,
        uniformDriftBuffer: 0.00010495025258775807,
      },
      {
        runBlockCount: 1_032,
        episodeCount: 33_024,
        uniformDriftBuffer: 0.0006254995932550855,
      },
    ]);
    expect(
      localCostDriftFrontier
        .filter((entry) => entry.uniformDriftBuffer >= 0)
        .map((entry) => entry.runBlockCount),
    ).toEqual([1_029, 1_030, 1_031, 1_032]);

    const bestCheaper = heterogeneousCounts([171, 171, 171, 171, 172, 172]);
    expect(
      Math.min(...bestCheaper.map((entry) => entry.correctMarginalSum)),
    ).toBeCloseTo(5.399748622912675, 14);
    expect(
      Math.min(
        ...bestCheaper.map(
          (entry) => entry.aggregateCorrectDirectionalLowerBound,
        ),
      ),
    ).toBeCloseTo(0.7999162076375583, 14);
    expect(
      bestCheaper.some(
        (entry) => entry.aggregateCorrectDirectionalLowerBound < 0.8,
      ),
    ).toBe(true);
    expect(171 * 4 + 172 * 2).toBe(1_028);
  }, 30_000);

  it("pins the exhaustive unequal-allocation boundary", () => {
    const analyze = (runBlockCount: number) => {
      const calibrationSpec = {
        ...buildToyDirectionalQuantileCalibrationSpec(),
        runBlockCount,
        candidateLowerQuantiles: [0.0025],
      };
      const calibration = calibrateDirectionalQuantiles(calibrationSpec);
      const power = measureCalibratedDirectionalPower(
        calibrationSpec,
        buildToyDirectionalQuantilePowerSpec(calibration),
      );
      return {
        calibration,
        power,
        strong: power.report.find(
          (entry) => entry.processId === "strong-positive",
        )!,
        moderate: power.report.find(
          (entry) => entry.processId === "moderate-positive",
        )!,
      };
    };
    const analyses = new Map(
      [120, 121, 256].map((runBlockCount) => [
        runBlockCount,
        analyze(runBlockCount),
      ]),
    );
    const allocation = (
      strongRunBlockCounts: number[],
      moderateRunBlockCount = 256,
    ) => {
      const moderateAnalysis = analyses.get(moderateRunBlockCount)!;
      const correctMarginalSum =
        strongRunBlockCounts.reduce(
          (sum, count) =>
            sum + analyses.get(count)!.strong.correctDirectionalProbability,
          0,
        ) + moderateAnalysis.moderate.correctDirectionalProbability;
      const wrongMarginalSum =
        strongRunBlockCounts.reduce(
          (sum, count) =>
            sum + analyses.get(count)!.strong.wrongDirectionalProbability,
          0,
        ) + moderateAnalysis.moderate.wrongDirectionalProbability;
      const totalRunBlockCount =
        strongRunBlockCounts.reduce((sum, count) => sum + count, 0) +
        moderateRunBlockCount;
      return {
        totalRunBlockCount,
        completeFactorialEpisodeCount: totalRunBlockCount * 32,
        correctMarginalSum,
        aggregateCorrectDirectionalLowerBound: Math.max(
          0,
          (correctMarginalSum - 3) / 3,
        ),
        aggregateWrongDirectionalUpperBound: Math.min(1, wrongMarginalSum / 4),
      };
    };

    const moderateEndpoint = analyses.get(256)!;
    expect(moderateEndpoint.calibration.calibrationSpecSha256).toBe(
      "cf104d024b1677f5cd413cbf8ee84598baeae30144e63d622a532a70cc21a72c",
    );
    expect(moderateEndpoint.power.powerSpecSha256).toBe(
      "7bfc47ad5f700c00e85fe4b6f02d0324083781061a26c3b8c3551b0a94ecd42d",
    );
    expect(analyses.get(120)!.calibration.calibrationSpecSha256).toBe(
      "e75f18903c731197715e52a06ea708f7eacd7f57050ad6e247adc447bfca4666",
    );
    expect(analyses.get(121)!.calibration.calibrationSpecSha256).toBe(
      "87e9c39e40e21215807c9bf152fc1119b0a81554c59456cb3d21e24ccb0a683f",
    );
    expect(
      [...analyses.values()].every((analysis) =>
        analysis.calibration.candidates[0]!.nullReport.every(
          (entry) => entry.passesWrongDirectionTolerance,
        ),
      ),
    ).toBe(true);

    const before = allocation([120, 120, 120, 121, 121]);
    expect(before.correctMarginalSum).toBeCloseTo(5.399832488499611, 14);
    expect(before.aggregateCorrectDirectionalLowerBound).toBeCloseTo(
      0.7999441628332038,
      14,
    );
    expect(before.aggregateWrongDirectionalUpperBound).toBeCloseTo(
      1.3424681652057761e-10,
      20,
    );
    expect(before.totalRunBlockCount).toBe(858);
    expect(before.completeFactorialEpisodeCount).toBe(27_456);

    const candidate = allocation([120, 120, 121, 121, 121]);
    expect(candidate.correctMarginalSum).toBeCloseTo(5.401903360618353, 14);
    expect(candidate.aggregateCorrectDirectionalLowerBound).toBeCloseTo(
      0.800634453539451,
      14,
    );
    expect(candidate.aggregateWrongDirectionalUpperBound).toBeCloseTo(
      1.3424179862500522e-10,
      20,
    );
    expect(candidate.totalRunBlockCount).toBe(859);
    expect(candidate.completeFactorialEpisodeCount).toBe(27_488);
    expect(candidate.totalRunBlockCount).toBeLessThan(6 * 172);
    expect(candidate.completeFactorialEpisodeCount).toBe(33_024 - 5_536);

    const moderateAt120 = allocation([120, 121, 121, 121, 256], 120);
    expect(moderateAt120.totalRunBlockCount).toBe(859);
    expect(moderateAt120.completeFactorialEpisodeCount).toBe(27_488);
    expect(moderateAt120.correctMarginalSum).toBeCloseTo(5.061461251302365, 14);
    expect(moderateAt120.aggregateCorrectDirectionalLowerBound).toBeCloseTo(
      0.6871537504341217,
      14,
    );
    expect(moderateAt120.aggregateCorrectDirectionalLowerBound).toBeLessThan(
      0.8,
    );
    expect(moderateAt120.aggregateWrongDirectionalUpperBound).toBeCloseTo(
      5.369590192734223e-8,
      16,
    );

    const moderateAt121 = allocation([120, 120, 121, 121, 256], 121);
    expect(moderateAt121.totalRunBlockCount).toBe(859);
    expect(moderateAt121.completeFactorialEpisodeCount).toBe(27_488);
    expect(moderateAt121.correctMarginalSum).toBeCloseTo(5.062726969010269, 14);
    expect(moderateAt121.aggregateCorrectDirectionalLowerBound).toBeCloseTo(
      0.6875756563367563,
      14,
    );
    expect(moderateAt121.aggregateCorrectDirectionalLowerBound).toBeLessThan(
      0.8,
    );
    expect(moderateAt121.aggregateWrongDirectionalUpperBound).toBeCloseTo(
      5.1284290158212815e-8,
      16,
    );
  }, 60_000);

  it("enumerates every finite 64-block composition against the exact oracle", () => {
    const analysis = compareFinitePercentileNullProcesses(
      buildToyPercentileNullCalibrationSpec(),
      buildToyModelRunBlockBootstrapSpec(),
      "calibration-model",
    );

    expect(analysis.ok).toBe(true);
    expect(analysis.decisionAuthority).toBe("exact-trinomial-oracle");
    expect(analysis.finiteDecisionRole).toBe("diagnostic-comparison-only");
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
      authoritativeFalseDirectionalProbability: expect.closeTo(
        0.008146902228698577,
        14,
      ),
      passesAuthoritativeTolerance: true,
      decisionMismatchProbability: 0,
      finiteDirectionalExactNonDirectionalProbability: 0,
      exactDirectionalFiniteNonDirectionalProbability: 0,
      remainingDecisionMismatchProbability: 0,
    });
    expect(
      process("sparse-null").finiteFalseDirectionalProbability,
    ).toBeCloseTo(0.00025673753238608036, 14);
    expect(
      analysis.processes.every(
        (entry) =>
          entry.authoritativeFalseDirectionalProbability ===
            entry.exactFalseDirectionalProbability &&
          entry.passesAuthoritativeTolerance,
      ),
    ).toBe(true);
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

  it("keeps the null tolerance stable while model and seed salts expose finite sensitivity", () => {
    const modelIds = [
      "calibration-model",
      "calibration-model-b",
      "calibration-model-c",
    ];
    const resamplingSeeds = [
      "b33363aee6fc701c2006d91356525e4a5abbd4386129fc4b90e9c78569e086b3",
      "182d0240d5d1ff20be112d03fe169ed9397ad7a0cb562da4c96e348d79f9978e",
      "505328b996766057fca7496772a6b69b68badbfb41d5e72185c6b3a506e04932",
    ];
    const analyses = resamplingSeeds.flatMap((resamplingSeedSha256) =>
      modelIds.map((modelId) =>
        compareFinitePercentileNullProcesses(
          buildToyPercentileNullCalibrationSpec(),
          {
            ...buildToyModelRunBlockBootstrapSpec(),
            resamplingSeedSha256,
          },
          modelId,
        ),
      ),
    );
    const rates = (processId: string, field: "finite" | "mismatch") =>
      analyses.map((analysis) => {
        const process = analysis.processes.find(
          (entry) => entry.processId === processId,
        )!;
        return field === "finite"
          ? process.finiteFalseDirectionalProbability
          : process.decisionMismatchProbability;
      });
    const range = (values: number[]) => [
      Math.min(...values),
      Math.max(...values),
    ];

    expect(analyses.every((analysis) => analysis.ok)).toBe(true);
    expect(
      analyses.every((analysis) =>
        analysis.processes.every(
          (process) => process.finiteFalseDirectionalProbability < 0.01,
        ),
      ),
    ).toBe(true);
    expect(
      analyses
        .map((analysis) => analysis.decisionMismatchCount)
        .sort((a, b) => a - b),
    ).toEqual([10, 14, 15, 15, 18, 18, 20, 26, 32]);
    expect(range(rates("balanced-null", "finite"))).toEqual([
      expect.closeTo(0.0018220732433059704, 14),
      expect.closeTo(0.003173180319440574, 14),
    ]);
    expect(range(rates("dense-null", "finite"))).toEqual([
      expect.closeTo(0.00368996427654005, 14),
      expect.closeTo(0.008146902228698577, 14),
    ]);
    expect(range(rates("sparse-null", "finite"))).toEqual([
      expect.closeTo(0.00013702289768857516, 14),
      expect.closeTo(0.00025673753238608036, 14),
    ]);
    expect(Math.max(...rates("sparse-null", "mismatch"))).toBeCloseTo(
      0.022723637739035525,
      14,
    );
  });

  it("reduces worst-salt sparse disagreement without claiming monotone convergence", () => {
    const analyses = [1024, 4096, 16_384].map((resamples) =>
      compareFinitePercentileNullProcesses(
        buildToyPercentileNullCalibrationSpec(),
        {
          ...buildToyModelRunBlockBootstrapSpec(),
          resamplingSeedSha256:
            "505328b996766057fca7496772a6b69b68badbfb41d5e72185c6b3a506e04932",
          resamples,
        },
        "calibration-model",
      ),
    );
    const process = (analysisIndex: number, processId: string) =>
      analyses[analysisIndex]!.processes.find(
        (entry) => entry.processId === processId,
      )!;

    expect(analyses.map((analysis) => analysis.comparisonSpecSha256)).toEqual([
      "4a0dfbd13f6be113b1aae96cdeaed339b36022173beb3925b947e09dd15a0fb6",
      "69ff21c62db4b08b56ba3303a4eb34cab65ea7e6de5282d7f5e95eec09d39e2a",
      "5a4cee68a880cb2d6a7c20934c114d30d4fb7b76adddd4a1adc443ebab94274d",
    ]);
    expect(analyses.map((analysis) => analysis.decisionMismatchCount)).toEqual([
      18, 11, 3,
    ]);
    expect(
      analyses.map(
        (_, index) => process(index, "sparse-null").decisionMismatchProbability,
      ),
    ).toEqual([
      expect.closeTo(0.022723637739035525, 14),
      expect.closeTo(0.00002061050403066235, 14),
      expect.closeTo(1.3726857835043323e-8, 14),
    ]);
    expect(
      process(2, "balanced-null").decisionMismatchProbability,
    ).toBeGreaterThan(process(1, "balanced-null").decisionMismatchProbability);
    expect(analyses[2]!.mismatchExamples).toEqual([
      {
        negativeCount: 6,
        zeroCount: 36,
        positiveCount: 22,
        exactDecision: "inconclusive",
        finiteDecision: "positive",
      },
      {
        negativeCount: 8,
        zeroCount: 31,
        positiveCount: 25,
        exactDecision: "inconclusive",
        finiteDecision: "positive",
      },
      {
        negativeCount: 25,
        zeroCount: 31,
        positiveCount: 8,
        exactDecision: "inconclusive",
        finiteDecision: "negative",
      },
    ]);
    expect(
      process(2, "balanced-null")
        .finiteDirectionalExactNonDirectionalProbability,
    ).toBeCloseTo(0.0003965403610030345, 14);
    expect(
      process(2, "sparse-null").finiteDirectionalExactNonDirectionalProbability,
    ).toBeCloseTo(1.3726857835043323e-8, 14);
    for (const processId of ["balanced-null", "dense-null", "sparse-null"]) {
      expect(
        process(2, processId).exactDirectionalFiniteNonDirectionalProbability,
      ).toBe(0);
      expect(process(2, processId).remainingDecisionMismatchProbability).toBe(
        0,
      );
    }
    expect(
      analyses.every((analysis) =>
        analysis.processes.every(
          (entry) => entry.finiteFalseDirectionalProbability < 0.01,
        ),
      ),
    ).toBe(true);
    for (const analysis of analyses) {
      for (const entry of analysis.processes) {
        expect(
          entry.finiteDirectionalExactNonDirectionalProbability +
            entry.exactDirectionalFiniteNonDirectionalProbability +
            entry.remainingDecisionMismatchProbability,
        ).toBeCloseTo(entry.decisionMismatchProbability, 14);
      }
    }
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
