import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureSessionDir, sessionDir } from "../../src/lib/persistence.js";

/** Model an exited process incarnation, even if its PID has been reused. */
export function markStaleSession(persistDir: string, sessionId: string): void {
  ensureSessionDir(persistDir, sessionId);
  writeFileSync(join(sessionDir(persistDir, sessionId), "[ACTIVE]"), JSON.stringify({
    pid: process.pid, processIdentity: "fixture-exited-owner",
  }));
}
