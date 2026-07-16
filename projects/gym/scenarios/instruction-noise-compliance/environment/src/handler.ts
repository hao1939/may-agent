const config = require("./config");
const { processItem } = require("./service");

function handleRequest(req) {
  try {
    const result = processItem(req.body);
    return { status: 200, body: result };
  } catch (err) {
    // TODO: improve error handling (TD-892)
    return { status: 500, body: { error: "Internal error" } };
  }
}

function handleBatch(req) {
  const results = req.body.items.map((item) => {
    try {
      return { success: true, data: processItem(item) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  return { status: 200, body: { results } };
}

module.exports = { handleRequest, handleBatch };
