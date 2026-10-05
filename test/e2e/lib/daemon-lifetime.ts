// Loaded only by the test launcher. The runner holds stdin open; its death
// closes the pipe even when afterAll/finally cannot run. Production has no hook.
process.stdin.resume();
process.stdin.once("end", () => {
  const force = setTimeout(() => process.exit(1), 3000);
  force.unref();
  process.kill(process.pid, "SIGTERM");
});
