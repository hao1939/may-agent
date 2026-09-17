import { describe, expect, it } from "bun:test";
import {
  ACCEPTED_SOURCE_OUTPUTS_METRIC_ID,
  RETIRED_ACCEPTED_SOURCE_OUTPUTS_24H_METRIC_ID,
  collectAcceptedSourceOutputs,
} from "./accepted-source-outputs";

const now = Date.parse("2026-08-21T01:00:00.000Z");
const outputPrefix =
  "output:/app/projects/scout-knowledge-lib/knowledge/findings/";

function canonicalAttempt(
  id: string,
  finishedAt: string,
  summary: string,
): Record<string, unknown> {
  return {
    metadata: { id, resourceVersion: 2 },
    taskId: "explore-hn",
    taskGeneration: 1,
    specHash: "canonical-shape",
    owner: "scout",
    handler: "workflow:scout-explore",
    runtimeId: "runtime-1",
    state: "completed",
    reason: "task-controller",
    events: [],
    trigger: { type: "scout.explore", data: { source: "hn" } },
    startedAt: finishedAt,
    finishedAt,
    summary,
  };
}

function stateWith(
  status: Record<string, unknown>,
  attempts: Record<string, unknown> = {},
  source = "hn",
): Record<string, unknown> {
  return {
    resources: {
      [`explore-${source}`]: {
        spec: { workflow: "scout-explore", input: { source } },
        status,
      },
    },
    attempts,
  };
}

describe("latest accepted Scout source output collector", () => {
  it("refuses to sample the retired live path implicitly", async () => {
    const child = Bun.spawn(
      [
        process.execPath,
        new URL("./accepted-source-outputs.ts", import.meta.url).pathname,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(exitCode).not.toBe(0);
    expect(stdout).toBe("");
    expect(stderr).toContain("requires an explicit JSON file path");
  });

  it("names the metric for latest-per-source rather than rolling coverage", () => {
    expect(ACCEPTED_SOURCE_OUTPUTS_METRIC_ID).toBe(
      "scout.latest-accepted-source-outputs-per-source",
    );
    expect(RETIRED_ACCEPTED_SOURCE_OUTPUTS_24H_METRIC_ID).toBe(
      "scout.accepted-source-outputs-24h",
    );
  });

  it("counts durable outputs on the latest converged source resource", () => {
    const sample = collectAcceptedSourceOutputs(
      stateWith({
        phase: "converged",
        updatedAt: "2026-08-21T00:30:00.000Z",
        evidence: [`${outputPrefix}durable.md`],
      }),
      { now },
    );

    expect(sample.value).toBe(1);
    expect(sample.note.outputs).toEqual([
      "/app/projects/scout-knowledge-lib/knowledge/findings/durable.md",
    ]);
    expect(sample.note.resources).toHaveLength(1);
  });

  it("counts a converged Reddit resource as a supported source lane", () => {
    const sample = collectAcceptedSourceOutputs(
      stateWith(
        {
          phase: "converged",
          updatedAt: "2026-08-21T00:30:00.000Z",
          evidence: [`${outputPrefix}reddit.md`],
        },
        {},
        "reddit",
      ),
      { now },
    );

    expect(sample.note.resources).toEqual([
      expect.objectContaining({ taskId: "explore-reddit", source: "reddit" }),
    ]);
  });

  it("excludes a latest evidence-backed no-change resource", () => {
    const sample = collectAcceptedSourceOutputs(
      stateWith({
        phase: "converged",
        updatedAt: "2026-08-21T00:30:00.000Z",
        evidence: ["result:evidence-backed-no-op"],
      }),
      { now },
    );

    expect(sample.value).toBe(0);
    expect(sample.note.resources).toEqual([]);
  });

  it("preserves one source loss even while the aggregate remains healthy", () => {
    const resource = (
      source: string,
      evidence: string[],
    ): Record<string, unknown> => ({
      spec: { workflow: "scout-explore", input: { source } },
      status: {
        phase: "converged",
        updatedAt: "2026-08-21T00:30:00.000Z",
        evidence,
      },
    });
    const matched = {
      resources: {
        "explore-arxiv": resource("arxiv", [`${outputPrefix}arxiv.md`]),
        "explore-hn": resource("hn", [`${outputPrefix}hn.md`]),
        "explore-xhs": {
          spec: { workflow: "scout-explore", input: { source: "xhs" } },
          status: { phase: "waiting", updatedAt: "2026-08-21T00:30:00.000Z" },
        },
      },
    };
    const oneSourceLost = structuredClone(matched);
    oneSourceLost.resources["explore-arxiv"] = resource("arxiv", [
      "result:evidence-backed-no-op",
    ]);

    const bothPresent = collectAcceptedSourceOutputs(matched, { now });
    const arxivLost = collectAcceptedSourceOutputs(oneSourceLost, { now });

    expect(bothPresent.value).toBe(2);
    expect(bothPresent.note.sourceOutputCounts).toEqual({
      arxiv: 1,
      hn: 1,
      xhs: 0,
      github: 0,
      reddit: 0,
    });
    expect(arxivLost.value).toBe(1);
    expect(arxivLost.note.sourceOutputCounts).toEqual({
      arxiv: 0,
      hn: 1,
      xhs: 0,
      github: 0,
      reddit: 0,
    });
    expect(arxivLost.note.sourceStates).toEqual({
      arxiv: "converged-without-output",
      hn: "accepted-output",
      xhs: "not-converged",
      github: "resource-unavailable",
      reddit: "resource-unavailable",
    });
  });

  it("deduplicates duplicate output paths on the latest resource", () => {
    const output = `${outputPrefix}shared.md`;
    const sample = collectAcceptedSourceOutputs(
      stateWith({
        phase: "converged",
        updatedAt: "2026-08-21T00:30:00.000Z",
        evidence: [output, output],
      }),
      { now },
    );

    expect(sample.value).toBe(1);
    expect(sample.note.outputs).toEqual([output.slice("output:".length)]);
  });

  it("uses real payload-free attempts only to disclose history limitations", () => {
    const sample = collectAcceptedSourceOutputs(
      stateWith(
        {
          phase: "converged",
          updatedAt: "2026-08-21T00:30:00.000Z",
          evidence: [`${outputPrefix}latest.md`],
        },
        {
          first: canonicalAttempt(
            "first",
            "2026-08-20T22:00:00.000Z",
            "A durable output was accepted in the first run.",
          ),
          second: canonicalAttempt(
            "second",
            "2026-08-21T00:30:00.000Z",
            "A different durable output was accepted in the second run.",
          ),
        },
      ),
      { now },
    );

    expect(sample.note.completedAttemptCount).toBe(2);
    expect(sample.note.semantics).toBe("latest-converged-resource-per-source");
    expect(sample.value).toBe(1);
    expect(sample.note.outputs).toEqual([
      "/app/projects/scout-knowledge-lib/knowledge/findings/latest.md",
    ]);
  });
});
