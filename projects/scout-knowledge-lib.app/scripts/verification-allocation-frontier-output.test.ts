import { describe, expect, it } from "bun:test";
import {
  IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA,
  withIdentityRobustFrontierOutputSchema,
} from "./verification-allocation-frontier-output";

describe("identity-robust frontier output", () => {
  it("pins one top-level serialization schema over payload claims", () => {
    expect(
      withIdentityRobustFrontierOutputSchema({
        schema: "caller-supplied",
        rowSha256: "a".repeat(64),
      }),
    ).toEqual({
      schema: IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA,
      rowSha256: "a".repeat(64),
    });
  });
});
