import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createAppInputAdmission } from "./app-runtime.js";

describe("app runtime startup", () => {
  it.each([
    "headless",
    "headless-http",
    "tty",
    "no-schedules",
    "activation-failure",
    "reporting-failure",
    "no-interfaces",
    "overlapping-reloads",
    "overlapping-preparation",
    "worker-publication",
  ])(
    "observes startup and explicit reload through real runtime (%s)",
    async (mode) => {
      const { stdout } = await promisify(execFile)(
        process.execPath,
        [fileURLToPath(new URL("../../test/fixtures/runtime-startup.ts", import.meta.url)), mode],
        { timeout: 15_000 },
      );
      expect(stdout).toContain("startup-contract-ok");
    },
    20_000,
  );

  it("keeps the production daemon on background and socket interfaces", () => {
    const entrypoint = readFileSync(new URL("../../container/entrypoint.sh", import.meta.url), "utf8");
    const defaultArgs = entrypoint.match(/export MAY_ARGS="\$\{MAY_ARGS:-(.*?)\}"/)?.[1] ?? "";
    expect(defaultArgs.trim()).toBe("--cron --telegram --socket");
  });
});

describe("App input control admission", () => {
  const command = {
    appId: "alpha-project",
    targetTaskId: "normalization/current",
    input: { kind: "message", data: { message: "review" } },
    source: { kind: "human", id: "web-ui:project-comment-17" },
    conversationId: "web-ui:project:alpha-project",
    channel: "web-ui",
    idempotencyKey: "project-comment-17",
  };

  it("validates against the live App registry before emitting one retry-safe App input", () => {
    const events: Array<Record<string, unknown>> = [];
    const admit = createAppInputAdmission({
      events: {
        publish: ((event: Record<string, unknown>, context: Record<string, unknown>) => {
          events.push({ event, context });
          return { eventId: 91, eventType: "app.input.requested", delivery: "accepted" };
        }) as never,
      },
    });

    expect(admit(command)).toEqual({
      eventId: 91,
      eventType: "app.input.requested",
      delivery: "accepted",
    });
    expect(events).toEqual([
      {
        event: {
          type: "app.input.requested",
          target: { appId: "alpha-project" },
          idempotencyKey: "project-comment-17",
          data: {
            targetTaskId: "normalization/current",
            input: command.input,
            conversationId: command.conversationId,
            conversationSequence: undefined,
            channel: "web-ui",
            channelThreadId: undefined,
            channelMessageId: undefined,
          },
        },
        context: { source: "control-socket", inputSource: command.source },
      },
    ]);
  });

  it("rejects an input the registered App schema does not accept", () => {
    const admit = createAppInputAdmission({
      events: {
        publish: (() => {
          throw new Error("App alpha-project does not accept this input");
        }) as never,
      },
    });
    expect(() => admit(command)).toThrow("does not accept this input");
  });
});
