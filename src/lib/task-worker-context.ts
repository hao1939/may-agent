/** Internal process role, entered only through an explicit Host worker entry. */
let taskWorkerProcess = false;

export function enterTaskWorkerProcess(): void {
  if (!process.connected || typeof process.send !== "function") {
    throw new Error("Task worker mode requires its parent IPC connection");
  }
  taskWorkerProcess = true;
}

export function isTaskWorkerProcess(): boolean {
  return taskWorkerProcess;
}
