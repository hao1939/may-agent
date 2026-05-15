import { describe, expect, test } from "bun:test";
import {
  type CapabilityModel,
  enumerateSpace,
  summarizeCapabilityModel,
  validateCapabilityModel,
} from "./index.js";

const model: CapabilityModel = {
  version: 1,
  id: "sample",
  inputVariables: [
    { id: "cluster.kind", domain: ["standalone", "managed"] },
    { id: "appRouting.enabled", domain: ["true", "false"] },
    { id: "domain.kind", domain: ["default", "custom"] },
    { id: "tls.secret.present", domain: ["true", "false"] },
  ],
  inputDependencies: [
    { parent: "appRouting.enabled", parentValue: "true", child: "domain.kind" },
    { parent: "domain.kind", parentValue: "custom", child: "tls.secret.present" },
  ],
  inputConstraints: [
    {
      id: "custom-domain-requires-tls-secret",
      kind: "requires",
      if: [{ variable: "domain.kind", value: "custom" }],
      then: [{ variable: "tls.secret.present", value: "true" }],
    },
  ],
  expectationVariables: [
    { id: "deploy.status", domain: ["success", "fail"] },
    { id: "route.reachable", domain: ["true", "false"] },
    { id: "http.status", domain: ["200", "timeout"] },
  ],
  expectationDependencies: [
    { parent: "deploy.status", parentValue: "success", child: "route.reachable" },
    { parent: "route.reachable", parentValue: "true", child: "http.status" },
  ],
  features: [
    {
      id: "app-routing-default-domain",
      inputPath: [
        { variable: "appRouting.enabled", value: "true" },
        { variable: "domain.kind", value: "default" },
      ],
      expectationPath: [
        { variable: "deploy.status", value: "success" },
        { variable: "route.reachable", value: "true" },
        { variable: "http.status", value: "200" },
      ],
    },
  ],
  testCases: [
    {
      id: "default-domain-hello-world",
      featureId: "app-routing-default-domain",
      inputPath: [
        { variable: "appRouting.enabled", value: "true" },
        { variable: "domain.kind", value: "default" },
      ],
      expectationPath: [
        { variable: "deploy.status", value: "success" },
        { variable: "route.reachable", value: "true" },
        { variable: "http.status", value: "200" },
      ],
      observedPath: [{ variable: "deploy.status", value: "fail" }],
      result: "fail",
      evidence: ["ev1"],
    },
  ],
  evidence: [{ id: "ev1", kind: "artifact", path: "outputs/result.md" }],
};

describe("capability model", () => {
  test("validates finite DAG-backed spaces", () => {
    const result = validateCapabilityModel(model);
    expect(result.valid).toBe(true);
    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  test("enumerates active variables and constraints deterministically", () => {
    const { paths, truncated } = enumerateSpace(model, "input");
    const rendered = paths.map((path) => path.map((a) => `${a.variable}=${a.value}`).join(","));
    expect(truncated).toBe(false);
    expect(rendered).toContain("appRouting.enabled=false,cluster.kind=standalone");
    expect(rendered).toContain("appRouting.enabled=true,cluster.kind=standalone,domain.kind=default");
    expect(rendered).toContain("appRouting.enabled=true,cluster.kind=standalone,domain.kind=custom,tls.secret.present=true");
    expect(rendered).not.toContain("appRouting.enabled=true,cluster.kind=standalone,domain.kind=custom,tls.secret.present=false");
  });

  test("rejects dependency cycles", () => {
    const result = validateCapabilityModel({
      ...model,
      inputDependencies: [
        ...(model.inputDependencies ?? []),
        { parent: "domain.kind", child: "appRouting.enabled" },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "dependency-cycle")).toBe(true);
  });

  test("summarizes feature evidence status", () => {
    const summary = summarizeCapabilityModel(model);
    expect(summary.input.variables).toBe(4);
    expect(summary.failingFeatureIds).toEqual(["app-routing-default-domain"]);
    expect(summary.features[0]?.testCaseIds).toEqual(["default-domain-hello-world"]);
  });
});
