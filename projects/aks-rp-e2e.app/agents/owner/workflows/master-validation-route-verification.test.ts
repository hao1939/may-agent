import { describe, expect, test } from "bun:test";
import { name, workspace } from "./master-validation-route-verification.js";

describe("master-validation route verification workflow", () => {
  test("binds the shared spec reconciliation implementation to a main workspace", () => {
    expect(name).toBe("master-validation-route-verification");
    expect(workspace).toEqual({ kind: "task", baseBranch: "main" });
  });
});
