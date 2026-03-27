// Simple application — version 2.0 with bug fix
module.exports = {
  name: "my-app",
  version: "2.0.0",
  handler: function(req) {
    // Fixed: properly handle null inputs
    if (!req || !req.path) return { status: 400, body: "Bad request" };
    return { status: 200, body: `OK: ${req.path}` };
  }
};
