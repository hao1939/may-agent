/**
 * Main pipeline: load → parse → sessionize → compute stats
 */
const fs = require("fs");
const path = require("path");
const { parseLine } = require("./parser");
const { buildSessions } = require("./sessions");
const { computeStats } = require("./stats");

function analyze(logFile) {
  const raw = fs.readFileSync(logFile, "utf-8");
  const lines = raw.trim().split("\n");
  const entries = lines.map(parseLine).filter(Boolean);
  const sessions = buildSessions(entries);
  return computeStats(sessions);
}

module.exports = { analyze };
