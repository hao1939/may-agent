import { describe, expect, it } from "bun:test";
import {
  analyzeFactorialOutcomes,
  analyzeFactorialResultBundle,
  bootstrapFactorialModelRunBlocks,
  boundDirectionalStrictMajority,
  buildToyDirectionalQuantileCalibrationSpec,
  buildToyDirectionalQuantilePowerSpec,
  buildToyDirectionalStrictMajoritySpec,
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
      "c4f6c80564d7e83c2b99024a7d9ac0f84e98fdb0fc1aeb22bd00fb77b8adf24c",
    );
    expect(analysis.calibrationMethod).toBe("exact-trinomial-enumeration");
    expect(analysis.monteCarloStandardError).toBe(0);
    expect(analysis.runBlockCount).toBe(105);
    expect(directional.decisionDelta).toBe(0);
    expect(practical.decisionDelta).toBe(0.1);
    expect(directional.nullReport).toHaveLength(3);
    expect(directional.alternativeReport).toHaveLength(4);
    expect(
      directional.nullReport.every(
        (entry) => !entry.passesWrongDirectionTolerance,
      ),
    ).toBe(true);
    expect(
      practical.nullReport.every(
        (entry) => entry.passesWrongDirectionTolerance,
      ),
    ).toBe(true);
    expect(
      directional.nullReport.find((entry) => entry.processId === "dense-null")!
        .falseDirectionalProbability,
    ).toBeCloseTo(0.05044215663997886, 14);
    expect(
      practical.nullReport.find((entry) => entry.processId === "dense-null")!
        .falseDirectionalProbability,
    ).toBeCloseTo(0.0032209898687990566, 14);
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
    expect(analysis.scopeLimit).toContain(
      "directional claim does not inherit the practical claim's null-risk result",
    );
  });

  it("rejects an unfrozen estimand comparison", () => {
    const spec = buildToyPercentileEstimandComparisonSpec();
    for (const candidate of [
      { ...spec, directionalDecisionDelta: 0.01 },
      { ...spec, practicalDecisionDelta: 0 },
      { ...spec, runBlockCount: 257 },
      {
        ...spec,
        nullProcesses: spec.nullProcesses.map((process, index) =>
          index === 0
            ? { ...process, probabilities: [0.2, 0.5, 0.3] }
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
