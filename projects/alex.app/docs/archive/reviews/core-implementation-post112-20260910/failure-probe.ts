import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const repo = process.cwd();
const { Type, defineApp } = await import(`${repo}/packages/sdk/src/index.ts`);
const { getDb, closeDb } = await import(`${repo}/src/lib/db/connection.ts`);
const { DbWriter } = await import(`${repo}/src/lib/db-writer.ts`);
const { AppRegistry } = await import(`${repo}/src/app/core/apps/registry.ts`);
const { EventBus } = await import(`${repo}/src/app/core/events/bus.ts`);
const { HostCapacity } = await import(`${repo}/src/app/host-capacity.ts`);
const { startAppInboxRuntime } = await import(`${repo}/src/app/app-inbox-runtime.ts`);

const mode = process.argv[2];
if (!["ready-read", "dependency-read", "report-write"].includes(mode)) throw new Error("Choose a probe mode");
const root = mkdtempSync(join(tmpdir(), "may-core-failure-probe-"));
const db = getDb(root);
const bus = new EventBus();
const writer = new DbWriter(root);
let armed = false;
let injected = 0;
const prepare = db.prepare.bind(db);
db.prepare = (sql: string) => {
  if (armed && injected === 0 &&
      ((mode === "ready-read" && sql.includes("SELECT 1 AS ready FROM")) ||
       (mode === "dependency-read" && sql.includes("INDEXED BY idx_app_inbox_task_wait_recovery")))) {
    injected++;
    throw new Error(`Injected transient SQLite read failure: ${mode}`);
  }
  return prepare(sql);
};
bus.setPersistenceSubscriber((event: any) => {
  if (armed && mode === "report-write" && event.type === "info") {
    injected++;
    throw new Error("Injected diagnostic persistence failure");
  }
  return writer.handler(event);
});
bus.setDeliveryRecorder(writer.recordDelivery);
const app = defineApp({
  id: "sample", version: 1, agent: "sample",
  inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({}) }),
  requests: { mode: "agent" },
});
const registry = new AppRegistry(async () => [{ appDir: root, definition: app }]);
await registry.reload();
const capacity = new HostCapacity(2);
const runtime = await startAppInboxRuntime({
  db, bus, registry, hostCapacity: capacity, deferStart: true,
  readDependency: async () => null,
  resolveRequest: async () => {
    if (mode === "report-write") throw new Error("Injected model execution failure");
    return { summary: "Answered", response: "Synthetic answer", topic: { kind: "none" } };
  },
});
const outcome = Promise.withResolvers<any>();
const captureException = (error: Error) => outcome.resolve({ escapedAs: "uncaughtException", error: error.message, stack: error.stack });
const captureRejection = (error: any) => outcome.resolve({ escapedAs: "unhandledRejection", error: String(error), stack: error?.stack });
process.on("uncaughtException", captureException);
process.on("unhandledRejection", captureRejection);
runtime.host.admit({ id: "turn", appId: app.id, conversationId: "chat", conversationSequence: 1,
  source: { kind: "human", id: "human" }, input: { kind: "message", data: {} } });
armed = true;
await runtime.start();
const timeout = setTimeout(() => outcome.resolve({ escapedAs: null }), 2000);
const result = await outcome.promise;
clearTimeout(timeout);
armed = false;
runtime.close();
await new Promise((resolve) => setTimeout(resolve, 20));
console.log(JSON.stringify({ mode, injected, ...result, capacity: capacity.snapshot(), handling: runtime.host.get("turn")?.handling }, null, 2));
process.off("uncaughtException", captureException);
process.off("unhandledRejection", captureRejection);
closeDb(root);
rmSync(root, { recursive: true, force: true });
process.exitCode = result.escapedAs ? 0 : 1;
