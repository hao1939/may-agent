import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("app runtime startup order", () => {
  it("attaches Telegram admission before external ingress and cron work", () => {
    const source = readFileSync(new URL("./app-runtime.ts", import.meta.url), "utf8");
    const admission = source.indexOf("telegramBot = TELEGRAM_ENABLED");
    const externalIngress = source.indexOf("await startInterfaceRuntime(");
    const cronStartup = source.indexOf("await startCronRuntime(");

    expect(admission).toBeGreaterThan(-1);
    expect(admission).toBeLessThan(externalIngress);
    expect(admission).toBeLessThan(cronStartup);
  });

  it("starts the durable App inbox before opening external ingress", () => {
    const source = readFileSync(new URL("./app-runtime.ts", import.meta.url), "utf8");
    const appInbox = source.indexOf("await startAppInboxRuntime({");
    const externalIngress = source.indexOf("await startInterfaceRuntime(");

    expect(appInbox).toBeGreaterThan(-1);
    expect(appInbox).toBeLessThan(externalIngress);
  });

  it("runs App owners through the shared reconciliation capacity", () => {
    const source = readFileSync(new URL("./app-runtime.ts", import.meta.url), "utf8");
    expect(source).toContain("runOwner: (work) => runWithProjectAppRuntimeCapacity(bus, work)");
  });
});
