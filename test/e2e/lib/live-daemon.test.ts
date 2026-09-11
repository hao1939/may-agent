import { expect, setSystemTime, test } from "bun:test";
import { pollUntil } from "./live-daemon.js";

test("daemon polling deadlines survive a forward wall-clock correction", async () => {
  let calls = 0;
  try {
    const result = await pollUntil(
      () => {
        if (++calls === 1) {
          setSystemTime(new Date(Date.now() + 60_000));
          return null;
        }
        return "ready";
      },
      { timeoutMs: 1_000, intervalMs: 1 },
    );
    expect(result).toBe("ready");
    expect(calls).toBe(2);
  } finally {
    setSystemTime();
  }
});
