import { describe, expect, it } from "bun:test";
import { hasDuplicateJsonObjectKeys } from "./json-object-key-exactness";

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
});
