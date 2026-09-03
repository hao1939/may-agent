import { describe, expect, it } from "bun:test";
import {
  hasDuplicateJsonObjectKeys,
  hasExcessiveJsonNesting,
} from "./json-object-key-exactness";

describe("JSON object-key exactness", () => {
  it("treats escaped and literal spellings of one key as duplicates", () => {
    expect(
      hasDuplicateJsonObjectKeys(
        String.raw`{"decisionOwner":"fixture","decision\u004fwner":"fixture"}`,
      ),
    ).toBe(true);
    expect(
      hasDuplicateJsonObjectKeys(
        String.raw`{"nested":{"policy":true,"poli\u0063y":true}}`,
      ),
    ).toBe(true);
  });

  it("keeps repeated names in distinct object and array scopes valid", () => {
    expect(
      hasDuplicateJsonObjectKeys(`{
        "schema": "outer",
        "nested": { "schema": "inner" },
        "items": [{ "schema": "first" }, { "schema": "second" }]
      }`),
    ).toBe(false);
  });

  it("bounds structure without counting quoted braces", () => {
    expect(hasExcessiveJsonNesting(JSON.stringify("{".repeat(300)))).toBe(
      false,
    );
    expect(
      hasExcessiveJsonNesting(
        '{"value":'.repeat(256) + "null" + "}".repeat(256),
      ),
    ).toBe(false);
    expect(
      hasExcessiveJsonNesting(
        '{"value":'.repeat(257) + "null" + "}".repeat(257),
      ),
    ).toBe(true);
  });
});
