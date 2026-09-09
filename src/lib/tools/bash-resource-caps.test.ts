import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import {
  BASH_CAPTURE_TAIL_BYTES,
  createBashTool,
  createLocalBashOperations,
  DEFAULT_BASH_TIMEOUT,
  type BashToolDetails,
} from "./bash.js";

describe("P113 Bash Resource Caps", () => {
  it("DEFAULT_BASH_TIMEOUT is 120 seconds", () => {
    expect(DEFAULT_BASH_TIMEOUT).toBe(120);
  });

  it("applies default timeout when agent does not specify one", async () => {
    // Create a bash tool with a very short default timeout (1s) for testing
    const tool = createBashTool("/tmp", { defaultTimeout: 1 });
    // sleep 30 should be killed by the 1s default timeout
    await expect(tool.execute("id", { command: "sleep 30" })).rejects.toThrow(/timed out/);
  });

  it.each([
    [undefined, undefined, 120],
    [1, undefined, 1],
    [1, 2, 2],
    [0, undefined, undefined],
    [0, 2, 2],
    [1, 0, 0],
  ])("passes default %s / explicit %s as timeout %s to execution", async (defaultTimeout, timeout, expected) => {
    // A fast echo cannot prove timeout selection: inspect the execution boundary.
    const timeouts: Array<number | undefined> = [];
    const tool = createBashTool("/tmp", {
      defaultTimeout,
      operations: {
        async exec(_command, _cwd, options) {
          timeouts.push(options.timeout);
          options.onData(Buffer.from("ok"));
          return { exitCode: 0 };
        },
      },
    });
    expect((await tool.execute("policy", { command: "unused", timeout })).content[0].text).toBe("ok");
    expect(timeouts).toEqual([expected]);
  });

  it("normal commands complete within default timeout", async () => {
    // Use real default timeout — normal commands finish instantly
    const tool = createBashTool("/tmp");
    const result = await tool.execute("id", { command: "echo 'P113 resource caps working'" });
    expect(result.content[0].text).toContain("P113 resource caps working");
  });

  it("does not let a background descendant hold the tool call open", async () => {
    const tool = createBashTool("/tmp", { defaultTimeout: 10 });
    const startedAt = Date.now();
    const result = await tool.execute("id", {
      command: "sleep 30 & echo parent-exited",
    });

    expect(result.content[0].text).toContain("parent-exited");
    expect(Date.now() - startedAt).toBeLessThan(5_000);
  });

  it("settles concurrent shell calls from the same long-running process", async () => {
    const tool = createBashTool("/tmp", { defaultTimeout: 10 });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        tool.execute(`call-${index}`, {
          command: `printf 'call-%s\\n' ${index}`,
        }),
      ),
    );

    for (const [index, result] of results.entries()) {
      expect(result.content[0].text).toContain(`call-${index}`);
    }
  });

  it("releases process resources after repeated shell calls", async () => {
    const tool = createBashTool("/tmp", { defaultTimeout: 10 });
    const before = readdirSync("/proc/self/fd").length;

    for (let index = 0; index < 25; index += 1) {
      await tool.execute(`resource-${index}`, { command: "/bin/true" });
    }

    const after = readdirSync("/proc/self/fd").length;
    expect(after - before).toBeLessThanOrEqual(3);
  });

  it("keeps complete large output on disk without replaying it through the daemon", async () => {
    const outputBytes = 8 * 1024 * 1024;
    const tool = createBashTool("/tmp", { defaultTimeout: 10 });
    let transientBytes = 0;
    let transientUpdates = 0;

    const result = await tool.execute(
      "large-output",
      { command: `bun -e 'process.stdout.write("x".repeat(${outputBytes}))'` },
      undefined,
      (update) => {
        transientUpdates++;
        transientBytes += Buffer.byteLength(update.content[0]?.text ?? "");
      },
    );
    const details = result.details as BashToolDetails | undefined;
    const fullOutputPath = details?.fullOutputPath;

    expect(fullOutputPath).toBeString();
    expect(statSync(fullOutputPath!).size).toBe(outputBytes);
    expect(Buffer.byteLength(result.content[0]?.text ?? "")).toBeLessThan(BASH_CAPTURE_TAIL_BYTES);
    expect(transientUpdates).toBeLessThanOrEqual(2);
    expect(transientBytes).toBeLessThan(100);
    expect(result.content[0]?.text).toContain("Full output:");

    unlinkSync(fullOutputPath!);
  });

  it("observes steady output without copying more than one bounded tail into the Host", async () => {
    const outputChunks = 40;
    const outputChunkBytes = 8 * 1024;
    const operations = createLocalBashOperations();
    let hostReadBytes = 0;
    let progressSignals = 0;

    const execution = await operations.exec(
      `bun -e 'let count = 0; const chunk = "x".repeat(${outputChunkBytes}); const timer = setInterval(() => { process.stdout.write(chunk); if (++count === ${outputChunks}) clearInterval(timer); }, 30)'`,
      "/tmp",
      {
        onData: (data) => {
          hostReadBytes += data.byteLength;
        },
        onProgress: () => {
          progressSignals++;
        },
      },
    );

    expect(execution.totalOutputBytes).toBe(outputChunks * outputChunkBytes);
    expect(statSync(execution.fullOutputPath!).size).toBe(outputChunks * outputChunkBytes);
    expect(hostReadBytes).toBeLessThanOrEqual(BASH_CAPTURE_TAIL_BYTES);
    expect(progressSignals).toBeGreaterThan(0);
    expect(progressSignals).toBeLessThanOrEqual(2);

    unlinkSync(execution.fullOutputPath!);
  });

  it("retains real large output when aborted after capture is observed", async () => {
    const outputBytes = 2 * 1024 * 1024;
    const controller = new AbortController();
    const local = createLocalBashOperations();
    const tool = createBashTool("/tmp", {
      defaultTimeout: 10, // Failure bound, not an assumption about how fast output arrives.
      operations: {
        ...local,
        exec(command, cwd, options) {
          return local.exec(command, cwd, {
            ...options,
            onProgress(bytes) {
              if (bytes === outputBytes) controller.abort();
            },
          });
        },
      },
    });
    let fullOutputPath: string | undefined;
    try {
      const error = await tool
        .execute(
          "large-abort",
          {
            command: `bun -e 'process.stdout.write("x".repeat(${outputBytes})); setTimeout(() => {}, 10_000)'`,
          },
          controller.signal,
        )
        .then(
          () => {
            throw new Error("expected interrupted command");
          },
          (caught: Error) => caught,
        );
      fullOutputPath = error.message.match(/Full output: ([^\]]+)/)?.[1];
      expect(error.message).toContain("Command aborted");
      expect(controller.signal.aborted).toBe(true);
      expect(fullOutputPath).toBeString();
      expect(readFileSync(fullOutputPath!)).toEqual(Buffer.alloc(outputBytes, "x"));
      expect(Buffer.byteLength(error.message)).toBeLessThan(BASH_CAPTURE_TAIL_BYTES * 2);
    } finally {
      controller.abort();
      if (fullOutputPath) unlinkSync(fullOutputPath);
    }
  });

  it("includes retained capture evidence when execution reports a timeout", async () => {
    const tool = createBashTool("/tmp", {
      defaultTimeout: 0.3,
      operations: {
        retainsFullOutput: true,
        async exec(_command, _cwd, options) {
          options.onData(Buffer.from("last output"));
          throw Object.assign(new Error(`timeout:${options.timeout}`), {
            fullOutputPath: "/tmp/example-bash-capture.log",
            totalOutputBytes: 2 * 1024 * 1024,
          });
        },
      },
    });
    await expect(tool.execute("timeout-evidence", { command: "unused" })).rejects.toThrow(
      /last output[\s\S]*Full output: \/tmp\/example-bash-capture.log[\s\S]*Command timed out after 0.3 seconds/,
    );
  });

  it("tool description mentions the default timeout", () => {
    const tool = createBashTool("/tmp");
    expect(tool.description).toContain("120s");
  });

  it("custom defaultTimeout appears in description", () => {
    const tool = createBashTool("/tmp", { defaultTimeout: 60 });
    expect(tool.description).toContain("60s");
  });
});
