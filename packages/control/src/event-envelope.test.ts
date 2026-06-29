import { describe, expect, it } from "bun:test";
import { buildCanonicalEventEnvelope, isCanonicalEventEnvelope, normalizeEventOwner } from "./event-envelope.js";

describe("event envelope helpers", () => {
  it("normalizes owners with the human deputy rule", () => {
    expect(normalizeEventOwner(undefined)).toBe("agent:may");
    expect(normalizeEventOwner("may")).toBe("agent:may");
    expect(normalizeEventOwner("agent:dev")).toBe("agent:dev");
    expect(normalizeEventOwner("project:alpha-project")).toBe("project:alpha-project");
    expect(normalizeEventOwner("task:alpha-project/loop")).toBe("task:alpha-project/loop");
    expect(normalizeEventOwner("human")).toBe("human:operator");
    expect(normalizeEventOwner("human:reviewer")).toBe("human:reviewer");
  });

  it("wraps payload fields under data and keeps infra metadata on the envelope", () => {
    expect(
      buildCanonicalEventEnvelope("escalation.created", {
        source: "agent:dev",
        owner: "human",
        urgency: "high",
        ttl_ms: 5000,
        reason: "blocked",
      }),
    ).toEqual({
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
    expect(
      buildCanonicalEventEnvelope("metric.breach", {
        type: "metric.breach",
        source: "metrics",
        owner: "may",
        data: { metricId: "system.health" },
        message: "check",
      }),
    ).toEqual({
      type: "metric.breach",
      source: "metrics",
      owner: "agent:may",
      data: {
        metricId: "system.health",
        message: "check",
      },
    });
  });

  it("keeps target on the envelope instead of moving it into data", () => {
    expect(
      buildCanonicalEventEnvelope("project.task.completed", {
        source: "agent:worker",
        owner: "aks-explorer",
        target: { project: "alpha-project", taskId: "task-a" },
        result: "done",
      }),
    ).toEqual({
      type: "project.task.completed",
      source: "agent:worker",
      owner: "agent:aks-explorer",
      target: { project: "alpha-project", taskId: "task-a" },
      data: {
        result: "done",
      },
    });
  });

  it("infers project owner from target before fallback owner", () => {
    expect(
      buildCanonicalEventEnvelope(
        "project.task.completed",
        {
          source: "agent:worker",
          target: { project: "alpha-project", taskId: "task-a" },
          result: "done",
        },
        { owner: "aks-explorer" },
      ),
    ).toEqual({
      type: "project.task.completed",
      source: "agent:worker",
      owner: "project:alpha-project",
      target: { project: "alpha-project", taskId: "task-a" },
      data: {
        result: "done",
      },
    });
  });

  it("keeps explicit owner ahead of target owner inference", () => {
    expect(
      buildCanonicalEventEnvelope("message.created", {
        source: "agent:dev",
        owner: "human",
        target: { project: "alpha-project", human: true },
        content: "approve",
      }),
    ).toEqual({
      type: "message.created",
      source: "agent:dev",
      owner: "human:operator",
      target: { project: "alpha-project", human: true },
      data: {
        content: "approve",
      },
    });
  });

  it("infers human owner from human target before project target", () => {
    expect(
      buildCanonicalEventEnvelope("message.created", {
        source: "agent:dev",
        target: { project: "alpha-project", human: true },
        content: "approve",
      }),
    ).toEqual({
      type: "message.created",
      source: "agent:dev",
      owner: "human:operator",
      target: { project: "alpha-project", human: true },
      data: {
        content: "approve",
      },
    });
  });

  it("preserves caller-built canonical envelopes", () => {
    const event = buildCanonicalEventEnvelope("message.created", {
      source: "agent:dev",
      owner: "agent:reviewer",
      target: { human: true },
      data: { content: "please review" },
    });

    expect(isCanonicalEventEnvelope(event)).toBe(true);
    expect(event).toEqual({
      type: "message.created",
      source: "agent:dev",
      owner: "agent:reviewer",
      target: { human: true },
      data: { content: "please review" },
    });
  });
});
