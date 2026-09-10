// Source-review probe: real controller/capacity, no installed App or database.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const hostRoot = resolve(process.argv[2]);
const mode = process.argv[3] ?? "normal";
const { AppTaskController } = await import(pathToFileURL(resolve(hostRoot, "src/app/app-task-controller.ts")).href);
const { HostCapacity } = await import(pathToFileURL(resolve(hostRoot, "src/app/host-capacity.ts")).href);
const failures: string[] = [];
if (mode !== "reporter-throws-default") {
  process.on("unhandledRejection", (error) => failures.push(`unhandledRejection:${String(error)}`));
  process.on("uncaughtException", (error) => failures.push(`uncaughtException:${String(error)}`));
}
const starts: string[] = [];
const reports: string[] = [];
let attempts = 0;
const capacity = new HostCapacity(2);
const controller = new AppTaskController({
  maxConcurrent: 1, capacity, maxRetries: 1, retryDelayMs: () => 5,
  reconcile(taskId: string) {
    starts.push(taskId);
    if (taskId === "bad") {
      attempts++;
      if (mode === "sync-throw") throw new Error("probe synchronous execution failure");
      if (attempts === 1) return Promise.reject(new Error("probe execution failure"));
    }
    return Promise.resolve();
  },
  onError(taskId: string, error: unknown, willRetry: boolean) {
    reports.push(`${taskId}:${willRetry}:${String(error)}`);
    if (mode.startsWith("reporter-throws")) throw new Error("probe diagnostic persistence failure");
  },
});
controller.enqueue("bad");
controller.enqueue("good");
setTimeout(() => {
  const result = { mode, starts, reports, failures, controller: controller.snapshot(), capacity: capacity.snapshot() };
  controller.close();
  console.log(JSON.stringify(result));
}, 200);
