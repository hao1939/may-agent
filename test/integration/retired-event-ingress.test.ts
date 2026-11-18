import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sendSocketCommand } from "../../packages/control/src/client.js";
import { EventBus } from "../../src/app/core/events/bus.js";
import { createEventInterface } from "../../src/app/core/events/interface.js";
import { startInterfaceRuntime, type InterfaceRuntime } from "../../src/app/interface-startup.js";
import { parseEmitMode, runEmitMode } from "../../src/app/modes/emit.js";
import { DbWriter } from "../../src/lib/db-writer.js";
import { closeDb, getDb } from "../../src/lib/db/connection.js";

test("direct socket frames and --emit reject retired types before persistence or App dispatch", async () => {
  const root = mkdtempSync(join(tmpdir(), "retired-event-ingress-"));
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const db = getDb(root);
  const events = createEventInterface({ bus, db, hasApp: () => false, validateAppInput: () => {} });
  const dispatched: string[] = [];
  const unsubscribe = bus.subscribeDurableRoute((event) => {
    dispatched.push(event.type);
    return { accepted: true, by: "retained-app-subscriber", route: "direct" };
  });
  const receipts: string[] = [];
  const emitOptions = {
    persistDir: root,
    instanceLabel: "test",
    interfaceAgent: "host",
    retry: { maxAttempts: 1 },
    writeReceipt: (message: string) => receipts.push(message),
  };
  let runtime: InterfaceRuntime | undefined;
  try {
    runtime = await startInterfaceRuntime({
      socketEnabled: true,
      persistDir: root,
      instanceLabel: "test",
      interfaceAgent: "host",
      events,
      getStatus: () => ({ sessions: [], activeWork: false }),
      reportInfo: () => {},
    });
    for (const type of [
      "chat.start.requested",
      "session.steer.requested",
      "session.cancel.requested",
      "session.cancel_all.requested",
      "project.comment.created",
    ]) {
      const data = {
        agent: "worker",
        sessionId: "s_retained",
        message: "hello",
        projectPath: "projects/sample.app",
        comment: "Review this",
      };
      await expect(
        sendSocketCommand(runtime.socketPath, { type, source: "control", owner: "system:host", data }),
      ).rejects.toMatchObject({
        kind: "definitive",
        message: expect.stringContaining("not admitted"),
      });
      const mode = parseEmitMode(["may-agent", "--emit", type, JSON.stringify(data)])!;
      await expect(runEmitMode({ ...emitOptions, mode })).rejects.toThrow("not admitted");
    }
    expect(receipts).toEqual([]);
    expect(dispatched).toEqual([]);
    expect(db.prepare("SELECT count(*) AS n FROM events").get()).toEqual({ n: 0 });

    // Domain facts still use operator ingress; retirement is exact, not a ban
    // on the unregistered-fact path used by Apps and diagnostics.
    await runEmitMode({ ...emitOptions, mode: { event: "fixture.observed", data: { value: 7 } } });
    expect(dispatched).toEqual(["fixture.observed"]);
    expect(db.prepare("SELECT event_type FROM events").all()).toEqual([{ event_type: "fixture.observed" }]);
    expect(receipts).toHaveLength(1);
  } finally {
    runtime?.socketUI.close();
    unsubscribe();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
