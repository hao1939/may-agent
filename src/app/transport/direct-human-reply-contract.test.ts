import { describe, expect, it } from "bun:test";
import { admitDirectHumanReply } from "./direct-human-reply-contract.js";

describe("direct human reply contract", () => {
  it("admits an immediate answer with no later commitment", () => {
    expect(
      admitDirectHumanReply({
        response: "The service is healthy and no action is needed.",
        commitment: { kind: "none" },
      }),
    ).toEqual({
      ok: true,
      reply: {
        response: "The service is healthy and no action is needed.",
        commitment: { kind: "none" },
      },
    });
  });

  it("admits truthful routing without a later-result promise", () => {
    expect(
      admitDirectHumanReply({
        response: "I am routing this to the reports owner. Durable acceptance is still pending.",
        commitment: {
          kind: "routing",
          intendedOwner: "reports.app owner",
          acceptanceNeeded:
            "One accepted reports task linked to this human trace, terminal proof, completion wake, and bounded review checkpoint",
        },
      }).ok,
    ).toBe(true);
  });

  it("admits an owned later commitment only with the full closure chain", () => {
    expect(
      admitDirectHumanReply({
        response: "The reports owner accepted this. I will send the verified report when it is ready.",
        commitment: {
          kind: "owned",
          owner: "reports.app owner",
          workRef: "reports/july-reliability",
          terminalProof: "Report artifact plus passing source-coverage check",
          completionWake: "project.task.reconciled",
          reviewCheckpoint: "warehouse-export Condition review after one hour",
        },
      }).ok,
    ).toBe(true);
  });

  it("rejects an owned commitment with a missing checkpoint", () => {
    expect(
      admitDirectHumanReply({
        response: "I will report back later.",
        commitment: {
          kind: "owned",
          owner: "reports.app owner",
          workRef: "reports/july-reliability",
          terminalProof: "Verified report",
          completionWake: "project.task.reconciled",
        },
      }),
    ).toMatchObject({ ok: false });
  });

  it("rejects unknown fields instead of growing another reply protocol", () => {
    expect(
      admitDirectHumanReply({
        response: "Done.",
        commitment: { kind: "none" },
        schedule: "weekly",
      }),
    ).toMatchObject({ ok: false });
  });
});
