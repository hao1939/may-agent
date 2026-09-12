import { AppTaskController } from "../../../src/app/core/tasks/controller.js";

// A focused acceptance probe, not a model trial. An ordinary wake must not
// defeat the cooldown after an execution failure. Nonzero means this is a gap.
async function probe(rewake: boolean) {
  let failedAt = 0;
  let calls = 0;
  let resolve!: (elapsed: number) => void;
  const done = new Promise<number>((yes) => {
    resolve = yes;
  });
  const controller = new AppTaskController({
    maxConcurrent: 1,
    retryDelayMs: () => 200,
    async reconcile() {
      calls++;
      if (calls === 1) throw new Error("Temporary execution failure");
      resolve(Date.now() - failedAt);
    },
    onError(id) {
      failedAt = Date.now();
      if (rewake) controller.enqueue(id);
    },
  });
  const timeout = setTimeout(() => resolve(-1), 2_000);
  try {
    controller.enqueue("retained-task");
    const elapsed = await done;
    return { rewake, configuredDelayMs: 200, observedDelayMs: elapsed, calls, backoffPreserved: elapsed >= 200 };
  } finally {
    clearTimeout(timeout);
    controller.close();
    await controller.whenDrained();
  }
}

const report = { baseline: await probe(false), wakeDuringBackoff: await probe(true) };
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.baseline.backoffPreserved && report.wakeDuringBackoff.backoffPreserved ? 0 : 1;
