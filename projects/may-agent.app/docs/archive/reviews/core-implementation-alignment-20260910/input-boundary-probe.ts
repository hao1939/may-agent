import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const [hostRoot, databasePath, mode] = process.argv.slice(2);
if (!hostRoot || !databasePath || !["retry", "renewal-control", "renewal-failure", "renewal-daemon"].includes(mode ?? "")) {
  throw new Error("Usage: bun input-boundary-probe.ts <host-root> <fresh-db-file> <mode>");
}
if (existsSync(databasePath)) throw new Error("Refusing to open an existing database; use a fresh temporary filename");
const source = (path: string) => pathToFileURL(resolve(hostRoot!, path)).href;
const { Type, defineApp } = await import(source("packages/sdk/src/index.ts"));
const { openDatabase } = await import(source("src/lib/db.ts"));
const { applyDbSchema } = await import(source("src/lib/db/schema.ts"));
const { AppInboxHost } = await import(source("src/app/app-inbox-host.ts"));
const app = defineApp({
  id: "review", version: 1, agent: "review-agent",
  inputSchema: Type.Object({kind: Type.Literal("message"), data: Type.Object({text: Type.String()})}),
  requests: {mode: "agent"},
});
let now = Date.now();
let calls = 0;
const runs = mode === "retry" ? 2 : 1;
for (let reopen = 0; reopen < runs; reopen++) {
  const db = openDatabase(databasePath!);
  applyDbSchema(db);
  const host = new AppInboxHost({
    db, apps: [app], now: mode === "retry" ? () => now : undefined,
    leaseMs: mode === "retry" ? 60_000 : 60,
    resolveRequest: async () => {
      calls++;
      if (mode === "retry") throw new Error("synthetic failed execution");
      await new Promise(resolve => setTimeout(resolve, 150));
      return {summary: "Probe completed", response: "Probe completed", topic: {kind: "none"}};
    },
  });
  if (reopen === 0) host.admit({id: "turn-1", appId: "review", conversationId: "review:primary", conversationSequence: 1,
    source: {kind: "human", id: "synthetic-human"}, input: {kind: "message", data: {text: "Review fixture"}}});
  if (mode === "renewal-daemon") {
    const { createDaemonLifecycle } = await import(source("src/app/daemon-lifecycle.ts"));
    createDaemonLifecycle({
      bus: {emit() {}}, manager: {}, loaderOpts: {},
      closeAllDbs: () => db.close(), writeIdentity() {}, processStartTime: Date.now(),
      getTelegramBot: () => undefined, getActiveReadline: () => null, clearActiveReadline() {},
    }).installProcessHandlers();
  }
  if (mode === "renewal-failure" || mode === "renewal-daemon") db.exec(`
    CREATE TRIGGER fail_renewal BEFORE UPDATE OF lease_expires_at ON app_inbox_items
    WHEN OLD.lease_owner IS NOT NULL AND NEW.lease_owner = OLD.lease_owner
      AND NEW.lease_expires_at > OLD.lease_expires_at
    BEGIN SELECT RAISE(ABORT, 'synthetic renewal write failure'); END;
  `);
  for (let pass = 0; pass < (mode === "retry" ? 6 : 1); pass++) {
    now += 2000;
    await host.reconcileOnce("review");
  }
  const row = host.get("turn-1");
  console.log(JSON.stringify({mode, reopen, calls, status: row.status, availableAt: row.availableAt, result: row.result}));
  db.close();
}
