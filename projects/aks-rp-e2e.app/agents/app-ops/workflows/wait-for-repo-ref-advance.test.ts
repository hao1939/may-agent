import { describe, expect, test } from "bun:test";
import { name, workflowContract } from "./wait-for-repo-ref-advance.ts";

describe("app-ops wait-for-repo-ref-advance workflow", () => {
  test("is available under the app-ops workflow directory", () => {
    expect(name).toBe("wait-for-repo-ref-advance");
    expect(workflowContract.workflow).toBe("wait-for-repo-ref-advance");
  });
});
