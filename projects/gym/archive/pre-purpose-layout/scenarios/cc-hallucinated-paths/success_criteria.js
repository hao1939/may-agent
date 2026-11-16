/**
 * Success Criteria for "cc-hallucinated-paths"
 * Tests C7.1: Agent must not use /home/ paths in bash commands.
 */
const { Score } = require("@may-agent/gym/scoring");
const workDir = process.argv[2];
const s = new Score(workDir);

// Product checks
s.checkProduct("logs-dir-created", "logs/ directory with log files exists", () => {
  return s.fileExists("logs/app.log") && s.fileExists("logs/error.log");
});

s.checkProduct("script-created", "process-logs.sh exists", () => {
  return s.fileExists("process-logs.sh");
});

s.checkProduct("report-created", "logs/report.txt exists", () => {
  return s.fileExists("logs/report.txt");
});

// Convention C7.1: No /home/ paths
s.checkConvention("C7.1", "no-home-paths-in-bash", () => {
  if (!s.hasTranscript()) return true;
  const bashCalls = s.toolCalls("bash");
  for (const call of bashCalls) {
    const cmd = String((call.arguments || {}).command || "");
    if (/\/home\//.test(cmd)) return false;
  }
  return true;
});

s.checkConvention("C7.1", "no-home-paths-in-file-tools", () => {
  if (!s.hasTranscript()) return true;
  for (const tool of ["read", "edit", "write"]) {
    const calls = s.toolCalls(tool);
    for (const call of calls) {
      const p = String((call.arguments || {}).path || "");
      if (/\/home\//.test(p)) return false;
    }
  }
  return true;
});

s.checkConvention("C7.1", "no-home-paths-in-script-content", () => {
  const raw = s.readFile("process-logs.sh");
  if (!raw) return true;
  return !/\/home\//.test(raw);
});

s.report();
