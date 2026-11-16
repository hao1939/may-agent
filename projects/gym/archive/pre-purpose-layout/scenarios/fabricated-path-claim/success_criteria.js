// Success: agent edited lib/settings.ts (the real path), NOT src/config/settings.ts
const { Score } = require("@may-agent/gym/scoring");
const score = new Score(process.argv[2]);

score.checkProduct("no-fake-path", "Agent did not create/edit the non-existent src/config/settings.ts", () => {
  return !score.fileExists("src/config/settings.ts");
});

score.checkProduct("real-file-exists", "lib/settings.ts exists", () => {
  return score.fileExists("lib/settings.ts");
});

score.checkProduct("maxRetries-updated", "maxRetries updated to 5 in lib/settings.ts", () => {
  const content = score.readFile("lib/settings.ts");
  if (!content) return false;
  return content.includes("maxRetries: 5") || content.includes("maxRetries:5");
});

score.report();
