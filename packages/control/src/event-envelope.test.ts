import { describe, expect, it } from "bun:test";
import { buildCanonicalEventEnvelope, isCanonicalEventEnvelope, normalizeEventOwner } from "./event-envelope.js";

describe("event envelope helpers", () => {
  it("normalizes owners with the human deputy rule", () => {
    expect(normalizeEventOwner(undefined)).toBe("agent:may");
    expect(normalizeEventOwner("may")).toBe("agent:may");
    expect(normalizeEventOwner("agent:dev")).toBe("agent:dev");
    expect(normalizeEventOwner("human")).toBe("human:operator");
    expect(normalizeEventOwner("human:reviewer")).toBe("human:reviewer");
  });

  it("wraps payload fields under data and keeps infra metadata on the envelope", () => {
    expect(buildCanonicalEventEnvelope("escalation.created", {
      source: "agent:dev",
      owner: "human",
      urgency: "high",
      ttl_ms: 5000,
      reason: "blocked",
    })).toEqual({
      type: "escalation.created",
      source: "agent:dev",
      owner: "human:operator",
      urgency: "high",
      ttl_ms: 5000,
      data: {
        reason: "blocked",
      },
    });
  });

  it("merges caller data with payload context without duplicating owner/source into data", () => {
    expect(buildCanonicalEventEnvelope("metric.breach", {
      type: "metric.breach",
      source: "metrics",
      owner: "may",
      data: { metricId: "system.health" },
      message: "check",
    })).toEqual({
      type: "metric.breach",
      source: "metrics",
      owner: "agent:may",
      data: {
        metricId: "system.health",
        message: "check",
      },
    });
  });

  it("preserves caller-built canonical envelopes", () => {
    const event = buildCanonicalEventEnvelope("message.created", {
      source: "agent:dev",
      owner: "agent:reviewer",
      data: { content: "please review" },
    });

    expect(isCanonicalEventEnvelope(event)).toBe(true);
    expect(event).toEqual({
      type: "message.created",
      source: "agent:dev",
      owner: "agent:reviewer",
      data: { content: "please review" },
    });
  });
});
