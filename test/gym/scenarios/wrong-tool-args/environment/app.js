/**
 * Simple app entry point — not a real HTTP server, just exports handlers
 * for testing.
 */
const handlers = require("./modules/api/lib/handlers");
const db = require("./modules/store/lib/db");

module.exports = { handlers, db };
