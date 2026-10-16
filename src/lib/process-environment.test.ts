import { describe, expect, it } from "bun:test";
import {
  agentShellEnvironment,
  nativeCliEnvironment,
  taskAdmissionEnvironment,
  taskAttemptEnvironment,
} from "./process-environment.js";

const source: NodeJS.ProcessEnv = {
  PATH: "/usr/bin",
  HOME: "/home/agent",
  STATE_DIR: "/state",
  MODEL_API_KEY: "model-secret",
  MODEL_BASE_URL: "https://models.example.test",
  DEEPSEEK_API_KEY: "deepseek-secret",
  DEEPSEEK_BASE_URL: "https://deepseek.example.test",
  GH_TOKEN: "github-secret",
  TELEGRAM_BOT_TOKEN: "telegram-secret",
  TELEGRAM_CHAT_ID: "transport-target",
  KIMI_API_KEY: "unused-provider-secret",
  AWS_SECRET_ACCESS_KEY: "ambient-secret",
  MAY_TASK_ATTEMPT_CHILD: "1",
};

function keys(environment: NodeJS.ProcessEnv): string[] {
  return Object.keys(environment).sort();
}

describe("process credential boundaries", () => {
  it("gives Task admission only portable runtime configuration", () => {
    const environment = taskAdmissionEnvironment(source);
    expect(environment).toEqual({ HOME: "/home/agent", PATH: "/usr/bin", STATE_DIR: "/state" });
  });

  it("gives Task attempts model and GitHub credentials but no transport or unknown ambient credentials", () => {
    const environment = taskAttemptEnvironment(source);
    expect(environment.MODEL_API_KEY).toBe("model-secret");
    expect(environment.DEEPSEEK_API_KEY).toBe("deepseek-secret");
    expect(environment.GH_TOKEN).toBe("github-secret");
    expect(keys(environment)).not.toContain("TELEGRAM_BOT_TOKEN");
    expect(keys(environment)).not.toContain("TELEGRAM_CHAT_ID");
    expect(keys(environment)).not.toContain("KIMI_API_KEY");
    expect(keys(environment)).not.toContain("AWS_SECRET_ACCESS_KEY");
    expect(keys(environment)).not.toContain("MAY_TASK_ATTEMPT_CHILD");
  });

  it("gives native CLI workers model and GitHub access without transport credentials", () => {
    const environment = nativeCliEnvironment(source);
    expect(environment.MODEL_API_KEY).toBe("model-secret");
    expect(environment.GH_TOKEN).toBe("github-secret");
    expect(environment.TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(environment.AWS_SECRET_ACCESS_KEY).toBeUndefined();
  });

  it("gives agent bash GitHub access and runtime paths without any model or transport credential", () => {
    const environment = agentShellEnvironment(source);
    expect(environment.PATH).toBe("/usr/bin");
    expect(environment.STATE_DIR).toBe("/state");
    expect(environment.GH_TOKEN).toBe("github-secret");
    expect(environment.MODEL_API_KEY).toBeUndefined();
    expect(environment.DEEPSEEK_API_KEY).toBeUndefined();
    expect(environment.TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(environment.AWS_SECRET_ACCESS_KEY).toBeUndefined();
  });
});
