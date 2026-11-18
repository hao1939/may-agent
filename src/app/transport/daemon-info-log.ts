/** Forward daemon info events to the shared logger. MAY_DAEMON_QUIET=1 disables attachment. */
import type { EventBus } from "../core/events/bus.js";
import { log } from "@may-agent/sdk/runtime";

export function attachDaemonInfoLog(bus: EventBus): void {
  bus.listen(
    (event) => {
      const message = (event as { message?: unknown }).message;
      if (typeof message !== "string" || message.length === 0) return;
      log("info", message);
    },
    { label: "daemon-info-log", types: ["info"] },
  );
}
