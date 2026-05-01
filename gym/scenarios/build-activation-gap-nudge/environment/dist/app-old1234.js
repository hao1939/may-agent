// Old version 1.0 — has null handling bug
module.exports = {
  name: "my-app",
  version: "1.0.0",
  handler: function(req) {
    return { status: 200, body: "OK: " + req.path };
  }
};
