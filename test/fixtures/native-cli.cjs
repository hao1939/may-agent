// Portable native-protocol fixture. Never contacts a model or reads credentials.
const { spawn } = require("node:child_process");
const { writeFileSync } = require("node:fs");
const config = JSON.parse(process.argv[2]);
const emit = (event) => process.stdout.write(JSON.stringify(event) + "\n");
const complete = () => {
  const text = config.oversized
    ? "x".repeat(1024 * 1024 + 1)
    : (config.text ?? "Review completed: permission denied is quoted evidence, not a failure.");
  if (config.tool === "codex") {
    if (!config.noOutput) {
      if (config.resultPath) writeFileSync(config.resultPath, text);
      emit({ type: "item.completed", item: { type: "agent_message", text } });
    }
    if (!config.noProtocol) emit({ type: "turn.completed" });
    if (config.failedProtocol) emit({ type: "turn.failed", error: { message: "provider failed" } });
  } else {
    if (!config.noProtocol)
      emit({
        type: "result",
        subtype: config.failedProtocol ? "error" : "success",
        result: config.noOutput ? "" : text,
        session_id: "claude-thread",
      });
  }
  if (config.stderr) process.stderr.write(config.stderr);
};
if (config.tool === "codex") emit({ type: "thread.started", thread_id: "codex-thread" });
let progressTimer;
if (config.progress) {
  let step = 0;
  progressTimer = setInterval(() => {
    if (config.progress === "tokens") {
      emit({ type: "stream_event", event: { type: "content_block_delta", delta: { text: "thinking" } } });
    } else if (config.tool === "codex") {
      emit({ type: "item.completed", item: { id: String(step++), type: "command_execution", exit_code: 0 } });
    } else {
      emit({
        type: "user",
        message: { content: [{ type: "tool_result", tool_use_id: String(step++), content: "done" }] },
      });
    }
  }, 100);
}
if (config.descendant) {
  const child = spawn(process.execPath, ["-e", 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);'], {
    stdio: "ignore",
  });
  writeFileSync(config.descendant, String(child.pid));
}
if (config.hang) {
  process.on("SIGTERM", () => {
    if (!config.ignoreTerm) {
      complete();
      process.exit(0);
    }
  });
  emit({ type: "fixture.ready" });
  setInterval(() => {}, 1000);
} else {
  setTimeout(() => {
    clearInterval(progressTimer);
    complete();
    process.exitCode = config.exitCode ?? 0;
  }, config.delay ?? 0);
}
