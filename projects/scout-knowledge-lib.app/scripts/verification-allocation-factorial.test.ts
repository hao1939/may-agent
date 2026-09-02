import { describe, expect, it } from "bun:test";
import {
  buildToyFactorialSchedule,
  scheduleSha256,
  scoreAllocationAnswer,
  TOY_SCHEDULE_SHA256,
  verifyFactorialSchedule,
} from "./verification-allocation-factorial";

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
});
