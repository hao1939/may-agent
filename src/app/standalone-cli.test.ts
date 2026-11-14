import { describe, expect, test } from "bun:test";
import { parseStandaloneCliArgs, runStandaloneCli } from "./standalone-cli.js";

describe("standalone-cli", () => {
  test("parses positional target, string input, and flags", () => {
    const parsed = parseStandaloneCliArgs([
      "alex",
      "Summarize",
      "README.md",
      "--app",
      "alex.app",
      "--readonly",
      "--timeout=45000",
    ]);
    expect(parsed.target).toBe("alex");
    expect(parsed.input).toBe("Summarize README.md");
    expect(parsed.options.app).toBe("alex.app");
    expect(parsed.options.tools).toBe("readonly");
    expect(parsed.options.timeoutMs).toBe(45000);
  });

  test("auto-parses JSON input for workflow targets and reads stdin fallback", () => {
    const jsonParsed = parseStandaloneCliArgs([
      "tech-lead/verified-coder",
      '{"task":"Fix parser","verify":["bun","test"]}',
      "--json",
    ]);
    expect(jsonParsed.target).toBe("tech-lead/verified-coder");
    expect(jsonParsed.input).toEqual({ task: "Fix parser", verify: ["bun", "test"] });
    expect(jsonParsed.json).toBe(true);

    const stdinParsed = parseStandaloneCliArgs(["alex/review-change"], '{"subjectRef":"HEAD"}');
    expect(stdinParsed.input).toEqual({ subjectRef: "HEAD" });
  });

  test("invokes run(target, input, options) and formats human & JSON output", async () => {
    const out: string[] = [];
    const err: string[] = [];

    const res = await runStandaloneCli(
      ["reviewer", "Check diff", "--readonly"],
      {
        stdout: (line) => out.push(line),
        stderr: (line) => err.push(line),
        execute: async (target, input, options) => ({
          ok: true,
          started: true,
          status: "done",
          result: {
            type: "done",
            summary: `Ran ${target}: ${String(input)} (${options?.tools ?? "full"})`,
            output: { verdict: "pass" },
          },
          report: {} as any,
          childSessions: [],
        }),
      },
    );

    expect(res.exitCode).toBe(0);
    expect(err).toHaveLength(0);
    expect(out[0]).toBe("[done] Ran reviewer: Check diff (readonly)");
    expect(JSON.parse(out[1]!)).toEqual({ verdict: "pass" });
  });
});
