// Read-only process fixture; production HTTP always receives in-process owners.
import { resolve } from "node:path";
import { startWebUI } from "../../src/app/http/server.js";
import type { EventInterface } from "../../src/app/core/events/interface.js";
const args = process.argv;
const value = (name: string, fallback: string) => args[args.indexOf(name) + 1] ?? fallback;
const stateDir = resolve(value("--state-dir", ".state"));
const server = startWebUI({ stateDir, port: Number(value("--port", "0")), hostname: "127.0.0.1",
  services: {
    events: { publish() { throw new Error("Read-only HTTP fixture"); }, get() { return undefined; }, subscribe() { return () => {}; } } as unknown as EventInterface,
    getStatus: () => ({ sessions: [], activeWork: false }),
    getAppConversation: () => { throw new Error("Conversation unavailable"); },
    listApps: () => { throw new Error("App read unavailable"); },
    listTasks: () => { throw new Error("Task read unavailable"); },
    getTask: () => { throw new Error("Task read unavailable"); },
  },
});
console.log(`url: http://localhost:${server.port}`);
