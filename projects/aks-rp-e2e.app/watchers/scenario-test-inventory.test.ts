import { describe, expect, test } from "bun:test";
import {
  parseScenarioTestInventory,
  scenarioTestInventoryObservationEvent,
} from "./scenario-test-inventory.js";

describe("scenario-test inventory watcher", () => {
  test("turns strict inventory into a targeted level observation", () => {
    const observation = parseScenarioTestInventory(
      JSON.stringify({
        report: {
          generatedAt: "2026-07-20T04:32:07.602Z",
          activeSpecCount: 665,
          referencedPlainActiveSpecCount: 609,
          referencedScenarioWithAdapterCount: 600,
          directVitestImplementationCount: 56,
          missingAdapterFiles: ["features/serverless/tests/missing.test.ts"],
        },
        guard: {
          passed: false,
          remainingSpecReferencedPlainScenarioUnits: [{ adapterPath: "x" }],
          remainingRepoPlainScenarioFiles: [
            "features/serverless/tests/plain.ts",
          ],
        },
      }),
      1,
    );

    expect(observation).toMatchObject({
      state: "red",
      strictPassed: false,
      remainingSpecReferencedPlainScenarioCount: 1,
      remainingRepoPlainScenarioFileCount: 1,
      missingAdapterFiles: ["features/serverless/tests/missing.test.ts"],
    });
    expect(observation).not.toHaveProperty("error");
    expect(scenarioTestInventoryObservationEvent(observation)).toMatchObject({
      type: "aks.scenario-test-inventory.observed",
      target: { project: "aks-rp-e2e" },
      data: {
        observation: { state: "red" },
      },
    });
  });

  test("uses the full strict result rather than the missing-adapter subset", () => {
    expect(
      parseScenarioTestInventory(
        JSON.stringify({
          report: { missingAdapterFiles: [] },
          guard: {
            passed: false,
            remainingSpecReferencedPlainScenarioUnits: [{}],
            remainingRepoPlainScenarioFiles: [],
          },
        }),
        1,
      ),
    ).toMatchObject({
      state: "red",
      strictPassed: false,
      missingAdapterFiles: [],
      remainingSpecReferencedPlainScenarioCount: 1,
    });
  });

  test("reports observer failure instead of inventing inventory state", () => {
    expect(
      parseScenarioTestInventory("not-json", 1, "inventory failed"),
    ).toMatchObject({
      state: "error",
      missingAdapterFiles: [],
      error: "inventory failed",
    });
  });
});
