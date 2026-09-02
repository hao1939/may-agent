import { describe, expect, it } from "bun:test";
import {
  analyzeFactorialOutcomes,
  analyzeFactorialResultBundle,
  buildSyntheticFactorialSchedule,
  buildToyFactorialSchedule,
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
  });
});
