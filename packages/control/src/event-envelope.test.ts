import { describe, expect, it } from "bun:test";
import { buildCanonicalEventEnvelope, isCanonicalEventEnvelope, normalizeEventOwner } from "./event-envelope.js";

describe("event envelope helpers", () => {
  it("normalizes owners with the human deputy rule", () => {
    expect(normalizeEventOwner(undefined)).toBe("agent:may");
    expect(normalizeEventOwner("may")).toBe("agent:may");
    expect(normalizeEventOwner("agent:dev")).toBe("agent:dev");
    expect(normalizeEventOwner("project:aks-rp-e2e")).toBe("project:aks-rp-e2e");
    expect(normalizeEventOwner("task:aks-rp-e2e/loop")).toBe("task:aks-rp-e2e/loop");
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
      buildCanonicalEventEnvelope("project.task.reconciled", {
        source: "agent:worker",
        owner: "aks-explorer",
        target: { project: "aks-rp-e2e", taskId: "task-a" },
        disposition: "converged",
      }),
    ).toEqual({
      type: "project.task.reconciled",
      source: "agent:worker",
      owner: "agent:aks-explorer",
      target: { project: "aks-rp-e2e", taskId: "task-a" },
      data: {
        disposition: "converged",
      },
    });
  });

  it("keeps action on the envelope for selector routing", () => {
    expect(
      buildCanonicalEventEnvelope("project.task.tick", {
        source: "agent:worker",
        target: { project: "aks-rp-e2e", taskId: "loop-a" },
        action: "spec-loop",
        reason: "child-task-completed",
      }),
    ).toEqual({
      type: "project.task.tick",
      source: "agent:worker",
      owner: "project:aks-rp-e2e",
      target: { project: "aks-rp-e2e", taskId: "loop-a" },
      action: "spec-loop",
      data: {
        reason: "child-task-completed",
      },
    });
  });

  it("infers project owner from target before fallback owner", () => {
    expect(
      buildCanonicalEventEnvelope(
        "project.task.reconciled",
        {
          source: "agent:worker",
          target: { project: "aks-rp-e2e", taskId: "task-a" },
          disposition: "converged",
        },
        { owner: "aks-explorer" },
      ),
    ).toEqual({
      type: "project.task.reconciled",
      source: "agent:worker",
      owner: "project:aks-rp-e2e",
      target: { project: "aks-rp-e2e", taskId: "task-a" },
      data: {
        disposition: "converged",
      },
    });
  });

  it("keeps explicit owner ahead of target owner inference", () => {
    expect(
      buildCanonicalEventEnvelope("message.created", {
        source: "agent:dev",
        owner: "human",
        target: { project: "aks-rp-e2e", human: true },
        content: "approve",
      }),
    ).toEqual({
      type: "message.created",
      source: "agent:dev",
      owner: "human:operator",
      target: { project: "aks-rp-e2e", human: true },
      data: {
        content: "approve",
      },
    });
  });

  it("infers human owner from human target before project target", () => {
    expect(
      buildCanonicalEventEnvelope("message.created", {
        source: "agent:dev",
        target: { project: "aks-rp-e2e", human: true },
        content: "approve",
      }),
    ).toEqual({
      type: "message.created",
      source: "agent:dev",
      owner: "human:operator",
      target: { project: "aks-rp-e2e", human: true },
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
