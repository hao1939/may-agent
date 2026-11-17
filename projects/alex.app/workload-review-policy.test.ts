import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
test.each([[false, false], [false, true], [true, false], [true, true]])("the actual App publishes compatible schedule, mapping and policy with enabled=%s and notifications=%s", async (enabled, notifyOwners) => {
  const source = `
    const { default: app, taskForInput } = await import(${JSON.stringify(new URL("./app.ts", import.meta.url).href)});
    const { workloadReviewPolicy } = await import(${JSON.stringify(new URL("./workload-review-policy.ts", import.meta.url).href)});
    const schedule = app.schedules.find(item => item.id === "workload-review");
    let intent = null, denied = false;
    try { intent = taskForInput({ id: "scheduled-admission", input: { kind: "workload-review", data: {} } }).intent; }
    catch { denied = true; }
    console.log(JSON.stringify({ schedule: schedule ?? null, coordination: app.tasks.coordination ?? null, intent, denied,
      notifyOwners: workloadReviewPolicy().notifyOwners }));
  `;
  const { stdout } = await exec(process.execPath, ["-e", source], {
    env: { ...process.env, ALEX_WORKLOAD_REVIEW_ENABLED: String(enabled), ALEX_WORKLOAD_REVIEW_NOTIFY_OWNERS: String(notifyOwners) }, timeout: 10_000,
  });
  const result = JSON.parse(stdout.trim());
  expect(result.notifyOwners).toBe(enabled && notifyOwners);
  if (enabled) {
    expect(result.denied).toBe(false);
    expect(result.coordination).toEqual({ taskId: "runtime/workload-review", workflow: "alex/workload-review", maxAttemptMs: 90_000 });
    expect(result.schedule).toMatchObject({ intervalMs: 900_000, catchUp: "latest", input: { kind: "workload-review" } });
    expect(result.intent).toMatchObject({ id: result.coordination.taskId, workflow: result.coordination.workflow, agent: "alex" });
  } else {
    expect(result).toMatchObject({ schedule: null, coordination: null, intent: null, denied: true });
  }
});
